import mongoose from 'mongoose';
import { env } from './env';

/**
 * Establish the MongoDB connection. Fails fast if the database is unreachable
 * so the process does not start in a half-broken state.
 */
export const connectDatabase = async (): Promise<void> => {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri);
  console.log('✅ MongoDB connected');
};

export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
  console.log('🛑 MongoDB disconnected');
};
