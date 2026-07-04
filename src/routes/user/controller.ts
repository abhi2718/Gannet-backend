import { Request, Response } from 'express';
import { User } from '../../models/user.model';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import { buildUserListPipeline } from './helpers';

/**
 * GET /api/users — admin-only. Lists users with their name, email, phone, city,
 * join date (createdAt), order count and status, searchable across those fields
 * and filterable by status. Paginated (default/min page size 20). Uses an
 * aggregation that joins the order & address collections; see helpers.ts.
 */
export const listUsers = catchAsync(async (req: Request, res: Response) => {
  const page = Number(req.query.page);
  const limit = Number(req.query.limit);
  const skip = (page - 1) * limit;

  const pipeline = buildUserListPipeline(req.query, { skip, limit });
  const [facet] = await User.aggregate(pipeline);
  const data = facet?.data ?? [];
  const total = facet?.totalCount?.[0]?.count ?? 0;

  res.status(200).json({
    success: true,
    count: data.length,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
    data,
  });
});

/**
 * GET /api/users/:id — fetch a single user.
 */
export const getUser = catchAsync(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  res.status(200).json({ success: true, data: user });
});

/**
 * PATCH /api/users/:id — update a user's profile fields.
 */
export const updateUser = catchAsync(async (req: Request, res: Response) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  res.status(200).json({ success: true, data: user });
});

/**
 * DELETE /api/users/:id — remove a user.
 */
export const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  res.status(200).json({ success: true, data: null });
});
