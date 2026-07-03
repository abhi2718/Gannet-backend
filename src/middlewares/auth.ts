import { NextFunction, Request, Response } from 'express';
import { User } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { verifyToken } from '../utils/jwt';

/**
 * JWT guard. Reads the `Authorization: Bearer <token>` header, verifies it,
 * loads the user referenced by the token's `sub` (the MongoDB user id) and
 * attaches the full user document to `req.user`.
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Missing or malformed Bearer token');
    }

    const token = header.split(' ')[1];
    const payload = verifyToken(token);

    const user = await User.findById(payload.sub);
    if (!user) {
      throw ApiError.unauthorized('User for this token no longer exists');
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof ApiError) {
      return next(err);
    }
    next(ApiError.unauthorized('Invalid or expired token'));
  }
};

/**
 * Role guard used after `authenticate` to restrict a route to specific
 * user types (e.g. admin-only endpoints).
 */
export const authorize = (...types: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !types.includes(req.user.userType)) {
      return next(ApiError.forbidden('Insufficient permissions'));
    }
    next();
  };
};
