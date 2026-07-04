import { Request, Response } from 'express';
import { IUser, User } from '../../models/user.model';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import { signToken } from '../../utils/jwt';

/**
 * POST /api/auth/register — create an account and return a JWT.
 */
export const register = catchAsync(async (req: Request, res: Response) => {
  const { username, email, phoneNumber, password, userType } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    throw ApiError.conflict('Email is already registered');
  }

  const user = await User.create({
    username,
    email,
    phoneNumber,
    password,
    userType,
  });
  const token = signToken(user.id);

  res.status(201).json({ success: true, data: { user, token } });
});

/**
 * POST /api/auth/login — verify credentials and return a JWT.
 */
export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Password is `select: false`, so explicitly include it for comparison.
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const token = signToken(user.id);
  res.status(200).json({ success: true, data: { user, token } });
});

/**
 * GET /api/auth/me — return the currently authenticated user.
 */
export const me = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  res.status(200).json({ success: true, data: { user } });
});
