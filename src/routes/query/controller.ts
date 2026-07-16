import { Request, Response } from 'express';
import { Query } from '../../models/query.model';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';

// Escape user input before using it in a regex to avoid regex injection/ReDoS.
const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Build a Mongo filter from validated query params. A single free-text `search`
 * term matches (case-insensitively) against ANY of fullName / mobileNumber /
 * email / city via $or; `status` is an exact filter. Designed for type-ahead:
 * the client calls this on every keystroke.
 */
const buildQueryFilter = (q: Request['query']): Record<string, unknown> => {
  const filter: Record<string, unknown> = {};

  if (q.search) {
    const rx = { $regex: escapeRegex(String(q.search)), $options: 'i' };
    filter.$or = [
      { fullName: rx },
      { mobileNumber: rx },
      { email: rx },
      { city: rx },
    ];
  }
  if (q.status) filter.status = q.status;
  if (q.type) filter.type = q.type;
  return filter;
};

/**
 * POST /api/queries — public enquiry submission (no auth). Input is validated
 * and rate-limited upstream; here we just persist it.
 */
export const createQuery = catchAsync(async (req: Request, res: Response) => {
  const query = await Query.create(req.body);
  res.status(201).json({ success: true, data: query });
});

/**
 * GET /api/queries — admin-only, paginated list with search + status filter.
 */
export const listQueries = catchAsync(async (req: Request, res: Response) => {
  const page = Number(req.query.page);
  const limit = Number(req.query.limit);
  const skip = (page - 1) * limit;
  const filter = buildQueryFilter(req.query);

  const [queries, total] = await Promise.all([
    Query.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Query.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: queries.length,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
    data: queries,
  });
});

/**
 * PATCH /api/queries/:id — admin edits query fields and/or its status.
 */
export const updateQuery = catchAsync(async (req: Request, res: Response) => {
  const query = await Query.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!query) {
    throw ApiError.notFound('Query not found');
  }
  res.status(200).json({ success: true, data: query });
});

/**
 * DELETE /api/queries/:id — admin deletes a query.
 */
export const deleteQuery = catchAsync(async (req: Request, res: Response) => {
  const query = await Query.findByIdAndDelete(req.params.id);
  if (!query) {
    throw ApiError.notFound('Query not found');
  }
  res.status(200).json({ success: true, data: null });
});
