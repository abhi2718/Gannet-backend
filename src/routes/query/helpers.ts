import Joi from 'joi';

/**
 * Joi validation schemas for the query (enquiry) endpoints.
 */
export const createQuerySchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(120).required(),
  mobileNumber: Joi.string()
    .trim()
    .pattern(/^\+?[0-9\s\-()]{7,20}$/)
    .required()
    .messages({
      'string.pattern.base': 'mobileNumber must be a valid phone number',
    }),
  email: Joi.string().email().lowercase().required(),
  city: Joi.string().trim().min(2).max(120).required(),
  requirement: Joi.string().trim().min(3).max(120).required(),
  message: Joi.string().trim().min(3).max(2000).required(),
});

// Pagination query params. Page size defaults to 20 and is never below 20.
export const DEFAULT_PAGE_SIZE = 20;

export const listQueriesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number()
    .integer()
    .min(DEFAULT_PAGE_SIZE)
    .max(100)
    .default(DEFAULT_PAGE_SIZE),
});
