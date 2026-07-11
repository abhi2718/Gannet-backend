import { Request } from 'express';
import Joi from 'joi';
import { PipelineStage } from 'mongoose';
import { UserStatus, UserType } from '../../models/user.model';

const objectId = Joi.string()
  .pattern(/^[a-fA-F0-9]{24}$/)
  .message('Invalid id');

const phone = Joi.string()
  .trim()
  .pattern(/^\+?[0-9\s\-()]{7,20}$/)
  .messages({ 'string.pattern.base': 'phoneNumber must be a valid phone number' });

/**
 * Joi validation schemas for the user management endpoints.
 */
export const userIdParamSchema = Joi.object({
  id: objectId.required(),
});

export const updateUserSchema = Joi.object({
  username: Joi.string().trim().min(3).max(50).optional(),
  email: Joi.string()
    .email()
    .lowercase()
    .optional()
    .messages({ 'string.email': 'Email must be a valid email' }),
  phoneNumber: phone.optional(),
  userType: Joi.string()
    .valid(...Object.values(UserType))
    .optional(),
  status: Joi.string()
    .valid(...Object.values(UserStatus))
    .optional(),
}).min(1);

// Pagination query params. Page size defaults to 20 and is never below 20.
export const DEFAULT_PAGE_SIZE = 20;

// List + single-term search (name/email/phone/city/order count) + status filter.
export const listUsersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number()
    .integer()
    .min(DEFAULT_PAGE_SIZE)
    .max(100)
    .default(DEFAULT_PAGE_SIZE),
  search: Joi.string().trim().max(120).optional(),
  status: Joi.string()
    .valid(...Object.values(UserStatus))
    .optional(),
});

// Escape user input before using it in a regex to avoid regex injection/ReDoS.
export const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type PageBounds = { skip: number; limit: number };

/**
 * Admin user-list pipeline (GET /api/users). Joins each user's orders (to count
 * them) and addresses (to expose their cities), so a single `search` term can
 * match the user's name/email/phone OR any of their cities OR — when the term is
 * an integer — their exact order count. `status` filters before the joins. The
 * `password` hash and the raw joined arrays are projected out (aggregation
 * bypasses the model's `select:false`), and `$facet` returns the page + total.
 */
export const buildUserListPipeline = (
  q: Request['query'],
  { skip, limit }: PageBounds
): PipelineStage[] => {
  const preMatch: Record<string, unknown> = {};
  if (q.status) preMatch.status = q.status;

  const pipeline: PipelineStage[] = [
    { $match: preMatch },
    { $lookup: { from: 'orders', localField: '_id', foreignField: 'user', as: 'orders' } },
    { $lookup: { from: 'addresses', localField: '_id', foreignField: 'user', as: 'addresses' } },
    {
      $addFields: {
        orderCount: { $size: '$orders' },
        cities: { $setUnion: ['$addresses.city', []] },
      },
    },
  ];

  if (q.search) {
    const term = String(q.search);
    const rx = { $regex: escapeRegex(term), $options: 'i' };
    const or: Record<string, unknown>[] = [
      { username: rx },
      { email: rx },
      { phoneNumber: rx },
      { cities: rx },
    ];
    const asNumber = Number(term);
    if (Number.isInteger(asNumber)) or.push({ orderCount: asNumber });
    pipeline.push({ $match: { $or: or } });
  }

  pipeline.push(
    { $project: { password: 0, orders: 0, addresses: 0 } },
    {
      $facet: {
        data: [{ $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: 'count' }],
      },
    }
  );

  return pipeline;
};
