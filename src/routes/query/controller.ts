import { Request, Response } from 'express';
import { Query } from '../../models/query.model';
import { catchAsync } from '../../utils/catchAsync';

/**
 * POST /api/queries — public enquiry submission (no auth). Input is validated
 * and rate-limited upstream; here we just persist it.
 */
export const createQuery = catchAsync(async (req: Request, res: Response) => {
  const query = await Query.create(req.body);
  res.status(201).json({ success: true, data: query });
});

/**
 * GET /api/queries — admin-only, paginated list of submitted enquiries.
 */
export const listQueries = catchAsync(async (req: Request, res: Response) => {
  const page = Number(req.query.page);
  const limit = Number(req.query.limit);
  const skip = (page - 1) * limit;

  const [queries, total] = await Promise.all([
    Query.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    Query.countDocuments(),
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
