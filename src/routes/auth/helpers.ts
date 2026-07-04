import Joi from 'joi';
import { UserType } from '../../models/user.model';

/**
 * Joi validation schemas for the authentication endpoints.
 */
export const registerSchema = Joi.object({
  username: Joi.string().trim().min(3).max(50).required(),
  email: Joi.string().email().lowercase().required(),
  phoneNumber: Joi.string()
    .trim()
    .pattern(/^\+?[0-9\s\-()]{7,20}$/)
    .required()
    .messages({
      'string.pattern.base': 'phoneNumber must be a valid phone number',
    }),
  password: Joi.string().min(6).max(128).required(),
  userType: Joi.string()
    .valid(...Object.values(UserType))
    .optional(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().min(6).max(128).required(),
});
