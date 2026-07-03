import Joi from 'joi';
import { OrderStatus } from '../../models/order.model';

const objectId = Joi.string()
  .pattern(/^[a-fA-F0-9]{24}$/)
  .message('Invalid id');

/**
 * Joi validation schemas for the order endpoints.
 */
export const orderIdParamSchema = Joi.object({
  id: objectId.required(),
});

export const createOrderSchema = Joi.object({
  itemName: Joi.string().trim().min(1).max(120).required(),
  quantity: Joi.number().integer().min(1).required(),
  amount: Joi.number().min(0).required(),
  // Optional on create; defaults to now + 7 days at the model layer.
  estimatedDelivery: Joi.date().iso().optional(),
});

export const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(OrderStatus))
    .required(),
});

// Pagination query params. Page size defaults to 20 and is never below 20.
export const DEFAULT_PAGE_SIZE = 20;

export const listOrdersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number()
    .integer()
    .min(DEFAULT_PAGE_SIZE)
    .max(100)
    .default(DEFAULT_PAGE_SIZE),
});
