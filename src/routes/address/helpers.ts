import Joi from 'joi';

const objectId = Joi.string()
  .pattern(/^[a-fA-F0-9]{24}$/)
  .message('Invalid id');

/**
 * Joi validation schemas for the address endpoints. `landmark` is the only
 * optional field; street, pinCode and city are mandatory.
 */
export const addressIdParamSchema = Joi.object({
  id: objectId.required(),
});

export const createAddressSchema = Joi.object({
  street: Joi.string().trim().min(2).max(200).required(),
  pinCode: Joi.string().trim().min(3).max(20).required(),
  city: Joi.string().trim().min(2).max(100).required(),
  landmark: Joi.string().trim().max(200).optional(),
});

export const updateAddressSchema = Joi.object({
  street: Joi.string().trim().min(2).max(200).optional(),
  pinCode: Joi.string().trim().min(3).max(20).optional(),
  city: Joi.string().trim().min(2).max(100).optional(),
  landmark: Joi.string().trim().max(200).optional(),
}).min(1);

// Pagination query params. Page size defaults to 20 and is never below 20.
export const DEFAULT_PAGE_SIZE = 20;

export const listAddressesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number()
    .integer()
    .min(DEFAULT_PAGE_SIZE)
    .max(100)
    .default(DEFAULT_PAGE_SIZE),
});
