import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

interface ErrorBody {
  success: false;
  message: string;
  stack?: string;
}

/**
 * Global error handler. Normalises operational, Mongoose and unexpected errors
 * into a single JSON shape. Must be registered LAST, after all routes.
 */
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal server error';

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (isJsonParseError(err)) {
    statusCode = 400;
    message = 'Invalid JSON payload in request body';
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  } else if (isDuplicateKeyError(err)) {
    statusCode = 409;
    message = 'Duplicate value violates a unique constraint';
  } else if (err instanceof Error) {
    message = err.message;
  }

  const body: ErrorBody = { success: false, message };
  if (env.nodeEnv !== 'production' && err instanceof Error) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
};

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: number }).code === 11000
  );
}

// body-parser throws a SyntaxError with a `body` property and status 400 when
// the incoming JSON is malformed (e.g. a trailing comma left after editing).
function isJsonParseError(err: unknown): boolean {
  return (
    err instanceof SyntaxError &&
    'body' in err &&
    (err as { status?: number }).status === 400
  );
}
