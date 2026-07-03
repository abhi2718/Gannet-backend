import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';

/**
 * Catch-all for unmatched routes. Forwards a 404 ApiError to the global
 * error handler so unknown paths get a consistent JSON response.
 */
export const notFound = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};
