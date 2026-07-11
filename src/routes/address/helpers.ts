import Joi from 'joi';

const objectId = Joi.string()
  .pattern(/^[a-fA-F0-9]{24}$/)
  .message('Invalid id');

/**
 * Joi validation schemas for the address endpoints. On create every field is
 * required; `label`, `street`, `city`, `state` and `landmark` must be at least
 * four characters (`pinCode` at least three). Updates may send any subset.
 */
export const addressIdParamSchema = Joi.object({
  id: objectId.required(),
});

export const createAddressSchema = Joi.object({
  label: Joi.string().trim().min(4).max(50).required(),
  street: Joi.string().trim().min(4).max(200).required(),
  pinCode: Joi.string().trim().min(3).max(20).required(),
  city: Joi.string().trim().min(4).max(100).required(),
  state: Joi.string().trim().min(4).max(100).required(),
  landmark: Joi.string().trim().min(4).max(200).required(),
});

export const updateAddressSchema = Joi.object({
  label: Joi.string().trim().min(4).max(50).optional(),
  street: Joi.string().trim().min(4).max(200).optional(),
  pinCode: Joi.string().trim().min(3).max(20).optional(),
  city: Joi.string().trim().min(4).max(100).optional(),
  state: Joi.string().trim().min(4).max(100).optional(),
  landmark: Joi.string().trim().min(4).max(200).optional(),
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
