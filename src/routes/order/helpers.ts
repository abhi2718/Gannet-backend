import Joi from 'joi';
import { PipelineStage } from 'mongoose';
import { Request } from 'express';
import { IOrderItem, OrderStatus } from '../../models/order.model';

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

// A single product line. `amount` is the per-unit price for that bottle size.
const orderItemSchema = Joi.object({
  bottleSize: Joi.string().trim().min(1).max(60).required(),
  quantity: Joi.number().integer().min(1).required(),
  amount: Joi.number().min(0).required(),
});

// Σ(quantity × amount) over the order's items — the authoritative order total.
export const computeTotalAmount = (
  items: Pick<IOrderItem, 'quantity' | 'amount'>[]
): number => items.reduce((sum, i) => sum + i.quantity * i.amount, 0);

export const createOrderSchema = Joi.object({
  customerName: Joi.string().trim().min(2).max(120).required(),
  customerPhone: phone.required(),
  // One or more product lines; the cart may hold several bottle sizes.
  items: Joi.array().items(orderItemSchema).min(1).required(),
  // Reference to one of the current user's saved addresses.
  address: objectId.required(),
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
  items: Joi.array().items(orderItemSchema).min(1).optional(),
  address: objectId.optional(),
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

// Escape user input before using it in a regex to avoid regex injection/ReDoS.
export const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Own-order search/filter (used by GET /api/orders/my): a single `search` term
 * matched against customerName OR customerPhone OR bottleSize, an exact
 * `status`, and a `dateFrom`/`dateTo` range on createdAt.
 */
export const buildOrderFilter = (
  q: Request['query']
): Record<string, unknown> => {
  const filter: Record<string, unknown> = {};

  if (q.search) {
    const rx = { $regex: escapeRegex(String(q.search)), $options: 'i' };
    filter.$or = [
      { customerName: rx },
      { customerPhone: rx },
      { 'items.bottleSize': rx },
    ];
  }
  if (q.status) filter.status = q.status;

  if (q.dateFrom || q.dateTo) {
    const createdAt: Record<string, Date> = {};
    if (q.dateFrom) createdAt.$gte = new Date(String(q.dateFrom));
    if (q.dateTo) createdAt.$lte = new Date(String(q.dateTo));
    filter.createdAt = createdAt;
  }
  return filter;
};

type PageBounds = { skip: number; limit: number };

/**
 * Admin all-orders search pipeline (GET /api/orders). Joins the referenced
 * user and address so a single `search` term can match the customer name/phone
 * on the order OR the user's name/email/phone OR any part of the address.
 * status + date range are applied before the joins; `$facet` returns the page
 * of data and the total count together for correct pagination.
 */
export const buildAdminOrderPipeline = (
  q: Request['query'],
  { skip, limit }: PageBounds
): PipelineStage[] => {
  const preMatch: Record<string, unknown> = {};
  if (q.status) preMatch.status = q.status;
  if (q.dateFrom || q.dateTo) {
    const createdAt: Record<string, Date> = {};
    if (q.dateFrom) createdAt.$gte = new Date(String(q.dateFrom));
    if (q.dateTo) createdAt.$lte = new Date(String(q.dateTo));
    preMatch.createdAt = createdAt;
  }

  const pipeline: PipelineStage[] = [
    { $match: preMatch },
    { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user' } },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'addresses', localField: 'address', foreignField: '_id', as: 'address' } },
    { $unwind: { path: '$address', preserveNullAndEmptyArrays: true } },
  ];

  if (q.search) {
    const rx = { $regex: escapeRegex(String(q.search)), $options: 'i' };
    pipeline.push({
      $match: {
        $or: [
          { customerName: rx },
          { customerPhone: rx },
          { 'items.bottleSize': rx },
          { 'user.username': rx },
          { 'user.email': rx },
          { 'user.phoneNumber': rx },
          { 'address.street': rx },
          { 'address.city': rx },
          { 'address.pinCode': rx },
          { 'address.landmark': rx },
        ],
      },
    });
  }

  pipeline.push({
    $facet: {
      data: [{ $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limit }],
      totalCount: [{ $count: 'count' }],
    },
  });

  return pipeline;
};
