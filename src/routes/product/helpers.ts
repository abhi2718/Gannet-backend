import Joi from 'joi';

const objectId = Joi.string()
  .pattern(/^[a-fA-F0-9]{24}$/)
  .message('Invalid id');

/**
 * Joi validation schemas for the product endpoints.
 */
export const productIdParamSchema = Joi.object({
  id: objectId.required(),
});

export const createProductSchema = Joi.object({
  productName: Joi.string().trim().max(120).required(),
  url: Joi.string().uri().required(),
  price: Joi.number().min(0).required(),
  description: Joi.string().trim().max(2000).required(),
});

export const updateProductSchema = Joi.object({
  productName: Joi.string().trim().max(120).optional(),
  url: Joi.string().uri().optional(),
  price: Joi.number().min(0).optional(),
  description: Joi.string().trim().max(2000).optional(),
}).min(1);
