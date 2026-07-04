import { Request, Response } from 'express';
import { Address } from '../../models/address.model';
import { IUser, UserType } from '../../models/user.model';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';

/**
 * POST /api/addresses — create an address owned by the current user.
 */
export const createAddress = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const address = await Address.create({ ...req.body, user: user.id });
  res.status(201).json({ success: true, data: address });
});

/**
 * GET /api/addresses — the current user's own addresses (paginated).
 * A user may own many addresses; this lists only the caller's.
 */
export const listAddresses = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const page = Number(req.query.page);
  const limit = Number(req.query.limit);
  const skip = (page - 1) * limit;
  const filter = { user: user.id };

  const [addresses, total] = await Promise.all([
    Address.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Address.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: addresses.length,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
    data: addresses,
  });
});

// Load an address and enforce owner-or-admin access, else throw.
const findOwnedAddress = async (id: string, user: IUser) => {
  const address = await Address.findById(id);
  if (!address) {
    throw ApiError.notFound('Address not found');
  }
  if (user.userType !== UserType.ADMIN && address.user.toString() !== user.id) {
    throw ApiError.forbidden('You can only access your own addresses');
  }
  return address;
};

/**
 * GET /api/addresses/:id — a customer may only fetch their own address.
 */
export const getAddress = catchAsync(async (req: Request, res: Response) => {
  const address = await findOwnedAddress(req.params.id, req.user as IUser);
  res.status(200).json({ success: true, data: address });
});

/**
 * PATCH /api/addresses/:id — update an address the caller owns.
 */
export const updateAddress = catchAsync(async (req: Request, res: Response) => {
  const address = await findOwnedAddress(req.params.id, req.user as IUser);
  Object.assign(address, req.body);
  await address.save();
  res.status(200).json({ success: true, data: address });
});

/**
 * DELETE /api/addresses/:id — delete an address the caller owns.
 */
export const deleteAddress = catchAsync(async (req: Request, res: Response) => {
  const address = await findOwnedAddress(req.params.id, req.user as IUser);
  await address.deleteOne();
  res.status(200).json({ success: true, data: null });
});
