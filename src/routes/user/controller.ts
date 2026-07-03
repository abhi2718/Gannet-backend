import { Request, Response } from 'express';
import { User } from '../../models/user.model';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';

/**
 * GET /api/users — list all users.
 */
export const listUsers = catchAsync(async (_req: Request, res: Response) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: users.length, data: users });
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
