import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

/**
 * Validate and expose environment variables through a single typed object so
 * the rest of the application never touches `process.env` directly.
 */
const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(5000),
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
  MONGO_URI: Joi.string().required(),
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: Joi.number().default(100),
})
  .unknown()
  .required();

const { value: envVars, error } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const env = {
  nodeEnv: envVars.NODE_ENV as string,
  port: envVars.PORT as number,
  // Allowed CORS origins — comma-separated list (default: the localhost:3000 dev client).
  corsOrigins: (envVars.CORS_ORIGIN as string)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  mongoUri: envVars.MONGO_URI as string,
  jwt: {
    secret: envVars.JWT_SECRET as string,
    expiresIn: envVars.JWT_EXPIRES_IN as string,
  },
  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS as number,
    max: envVars.RATE_LIMIT_MAX as number,
  },
};
