import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

/**
 * The JWT payload intentionally carries ONLY the MongoDB user id. No email,
 * role or other data is embedded, keeping the token small and forcing a fresh
 * DB lookup on every authenticated request.
 */
export interface TokenPayload {
  sub: string;
}

export const signToken = (userId: string): string => {
  const payload: TokenPayload = { sub: userId };
  const options: SignOptions = {
    expiresIn: env.jwt.expiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.jwt.secret, options);
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.jwt.secret) as TokenPayload;
};
