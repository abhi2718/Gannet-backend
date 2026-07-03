import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

/**
 * Global API rate limiter. Caps the number of requests per IP inside the
 * configured window to mitigate brute-force and abuse.
 */
export const apiRateLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
});

/**
 * Stricter limiter for authentication endpoints (login/register).
 */
export const authRateLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: Math.max(5, Math.floor(env.rateLimit.max / 10)),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
});
