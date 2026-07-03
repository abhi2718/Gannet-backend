import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/db';
import { env } from './config/env';

/**
 * Application entry point: connect to MongoDB, start the HTTP server and wire
 * up graceful shutdown / crash handling.
 */
const bootstrap = async (): Promise<void> => {
  await connectDatabase();

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`🚀 gannet running on http://localhost:${env.port}`);
    console.log(`📚 Swagger docs at http://localhost:${env.port}/api-docs`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    server.close(() => process.exit(1));
  });
};

bootstrap().catch((err) => {
  console.error('Failed to start gannet:', err);
  process.exit(1);
});
