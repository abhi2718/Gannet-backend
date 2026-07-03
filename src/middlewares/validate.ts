import { NextFunction, Request, Response } from 'express';
import { ObjectSchema } from 'joi';
import { ApiError } from '../utils/ApiError';

type RequestPart = 'body' | 'query' | 'params';

/**
 * Generic Joi validation middleware. Validates the requested part of the
 * request and replaces it with the sanitised value (unknown keys stripped),
 * which also helps neutralise malicious payloads.
 */
export const validate = (schema: ObjectSchema, part: RequestPart = 'body') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[part], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const message = error.details.map((d) => d.message).join(', ');
      return next(ApiError.badRequest(message));
    }

    req[part] = value;
    next();
  };
};
