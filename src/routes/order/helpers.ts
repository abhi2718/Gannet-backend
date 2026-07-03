import Joi from 'joi';
import { OrderStatus } from '../../models/order.model';

const objectId = Joi.string()
  .pattern(/^[a-fA-F0-9]{24}$/)
  .message('Invalid id');

const phone = Joi.string()
  .trim()
  .pattern(/^\+?[0-9\s\-()]{7,20}$/)
  .messages({ 'string.pattern.base': 'customerPhone must be a valid phone number' });

/**
 * Joi validation schemas for the order endpoints.
 */
export const orderIdParamSchema = Joi.object({
  id: objectId.required(),
});

export const createOrderSchema = Joi.object({
  customerName: Joi.string().trim().min(2).max(120).required(),
  customerPhone: phone.required(),
  bottleSize: Joi.string().trim().min(1).max(60).required(),
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

/**
 * Admin edit: any subset of order fields (at least one), including status.
 */
export const updateOrderSchema = Joi.object({
  customerName: Joi.string().trim().min(2).max(120).optional(),
  customerPhone: phone.optional(),
  bottleSize: Joi.string().trim().min(1).max(60).optional(),
  quantity: Joi.number().integer().min(1).optional(),
  amount: Joi.number().min(0).optional(),
  estimatedDelivery: Joi.date().iso().optional(),
  status: Joi.string()
    .valid(...Object.values(OrderStatus))
    .optional(),
}).min(1);

// Pagination query params. Page size defaults to 20 and is never below 20.
export const DEFAULT_PAGE_SIZE = 20;

// List + single-term search (name/phone/bottleSize) + status + date range.
export const listOrdersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number()
    .integer()
    .min(DEFAULT_PAGE_SIZE)
    .max(100)
    .default(DEFAULT_PAGE_SIZE),
  search: Joi.string().trim().max(120).optional(),
  status: Joi.string()
    .valid(...Object.values(OrderStatus))
    .optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().optional(),
});
