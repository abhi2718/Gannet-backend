import { NextFunction, Request, Response, RequestHandler } from 'express';

/**
 * Wrap an async route handler so any rejected promise is forwarded to the
 * global error handler instead of crashing the process.
 */
export const catchAsync = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
