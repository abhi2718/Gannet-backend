import Joi from 'joi';
import { UserType } from '../../models/user.model';

const objectId = Joi.string()
  .pattern(/^[a-fA-F0-9]{24}$/)
  .message('Invalid id');

/**
 * Joi validation schemas for the user management endpoints.
 */
export const userIdParamSchema = Joi.object({
  id: objectId.required(),
});

export const updateUserSchema = Joi.object({
  username: Joi.string().trim().min(3).max(50).optional(),
  email: Joi.string().email().lowercase().optional(),
  userType: Joi.string()
    .valid(...Object.values(UserType))
    .optional(),
}).min(1);
