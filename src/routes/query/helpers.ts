import Joi from 'joi';
import { QueryStatus, QueryType } from '../../models/query.model';

const objectId = Joi.string()
  .pattern(/^[a-fA-F0-9]{24}$/)
  .message('Invalid id');

/**
 * Joi validation schemas for the query (enquiry) endpoints.
 */
export const queryIdParamSchema = Joi.object({
  id: objectId.required(),
});

export const createQuerySchema = Joi.object({
  fullName: Joi.string()
    .trim()
    .min(2)
    .max(120)
    .pattern(/^[A-Za-z][A-Za-z\s.'-]*$/)
    .required()
    .messages({ 'string.pattern.base': 'fullName can only contain letters' }),
  mobileNumber: Joi.string()
    .trim()
    .pattern(/^\+?[0-9\s\-()]{7,20}$/)
    .required()
    .messages({
      'string.pattern.base': 'mobileNumber must be a valid phone number',
    }),
  email: Joi.string()
    .email()
    .lowercase()
    .required()
    .messages({ 'string.email': 'Email must be a valid email' }),
  city: Joi.string().trim().min(2).max(120).required(),
  requirement: Joi.string()
    .trim()
    .min(10)
    .max(120)
    .required()
    .messages({ 'string.min': 'Requirement length must be at least 10 characters' }),
  message: Joi.string()
    .trim()
    .min(10)
    .max(2000)
    .required()
    .messages({ 'string.min': 'Message length must be at least 10 characters long' }),
  type: Joi.string()
    .valid(...Object.values(QueryType))
    .default(QueryType.QUERY),
});

/**
 * Admin edit: any subset of fields (at least one) plus the workflow status.
 */
export const updateQuerySchema = Joi.object({
  fullName: Joi.string()
    .trim()
    .min(2)
    .max(120)
    .pattern(/^[A-Za-z][A-Za-z\s.'-]*$/)
    .optional()
    .messages({ 'string.pattern.base': 'fullName can only contain letters' }),
  mobileNumber: Joi.string()
    .trim()
    .pattern(/^\+?[0-9\s\-()]{7,20}$/)
    .messages({
      'string.pattern.base': 'mobileNumber must be a valid phone number',
    })
    .optional(),
  email: Joi.string()
    .email()
    .lowercase()
    .optional()
    .messages({ 'string.email': 'Email must be a valid email' }),
  city: Joi.string().trim().min(2).max(120).optional(),
  requirement: Joi.string()
    .trim()
    .min(10)
    .max(120)
    .optional()
    .messages({ 'string.min': 'Requirement length must be at least 10 characters' }),
  message: Joi.string()
    .trim()
    .min(10)
    .max(2000)
    .optional()
    .messages({ 'string.min': 'Message length must be at least 10 characters long' }),
  status: Joi.string()
    .valid(...Object.values(QueryStatus))
    .optional(),
}).min(1);

// Pagination query params. Page size defaults to 20 and is never below 20.
export const DEFAULT_PAGE_SIZE = 20;

// List + a single free-text `search` term (matched against name OR mobile OR
// email OR city) + filter by status.
export const listQueriesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number()
    .integer()
    .min(DEFAULT_PAGE_SIZE)
    .max(100)
    .default(DEFAULT_PAGE_SIZE),
  search: Joi.string().trim().max(120).optional(),
  status: Joi.string()
    .valid(...Object.values(QueryStatus))
    .optional(),
  type: Joi.string()
    .valid(...Object.values(QueryType))
    .optional(),
});
