import cors from 'cors';
import express, { Application } from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import helmet from 'helmet';
import { env } from './config/env';
import { setupSwagger } from './config/swagger';
import { errorHandler } from './middlewares/errorHandler';
import { notFound } from './middlewares/notFound';
import { apiRateLimiter } from './middlewares/rateLimiter';
import routes from './routes';

/**
 * Build and configure the Express application. Keeping this separate from the
 * server bootstrap makes the app easy to import in tests.
 */
export const createApp = (): Application => {
  const app = express();

  // Security & parsing middleware.
  app.use(helmet());
  // Restrict cross-origin access to the configured origins (default: localhost:3000).
  // A `*` entry means "allow any origin": reflect the request origin so it still
  // works alongside `credentials: true` (a literal `*` is invalid with credentials).
  const corsOrigin = env.corsOrigins.includes('*') ? true : env.corsOrigins;
  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true }));

  // Strip keys containing `$` / `.` to prevent NoSQL (Mongo) injection.
  app.use(mongoSanitize());

  // Global rate limiting.
  app.use(apiRateLimiter);

  // API documentation.
  setupSwagger(app);

  // Application routes.
  app.use('/api', routes);

  // 404 handler for unmatched routes, then the global error handler (last).
  app.use(notFound);
  app.use(errorHandler);

  return app;
};
