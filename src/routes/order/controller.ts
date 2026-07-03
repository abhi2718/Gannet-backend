import { Request, Response } from 'express';
import { Order } from '../../models/order.model';
import { IUser, UserType } from '../../models/user.model';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';

/**
 * POST /api/orders — create an order owned by the current user.
 */
export const createOrder = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const order = await Order.create({ ...req.body, user: user.id });
  res.status(201).json({ success: true, data: order });
});

/**
 * Shared paginated responder for order lists. `filter` scopes the result set
 * ({} for all orders, { user } for a single user's orders).
 */
const respondWithPaginatedOrders = async (
  filter: Record<string, unknown>,
  req: Request,
  res: Response
): Promise<void> => {
  const page = Number(req.query.page);
  const limit = Number(req.query.limit);
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: orders.length,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
    data: orders,
  });
};

/**
 * GET /api/orders/my — the current user's own orders, paginated. Any
 * authenticated user; only ever returns orders they own.
 */
export const listMyOrders = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  await respondWithPaginatedOrders({ user: user.id }, req, res);
});

/**
 * GET /api/orders — every order, paginated. Admin only (enforced by the route).
 */
export const listAllOrders = catchAsync(async (req: Request, res: Response) => {
  await respondWithPaginatedOrders({}, req, res);
});

/**
 * GET /api/orders/:id — a customer may only fetch their own order; an admin any.
 */
export const getOrder = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const order = await Order.findById(req.params.id);
  if (!order) {
    throw ApiError.notFound('Order not found');
  }
  if (
    user.userType !== UserType.ADMIN &&
    order.user.toString() !== user.id
  ) {
    throw ApiError.forbidden('You can only access your own orders');
  }
  res.status(200).json({ success: true, data: order });
});

/**
 * PATCH /api/orders/:id/status — admin-only status transition.
 */
export const updateOrderStatus = catchAsync(
  async (req: Request, res: Response) => {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );
    if (!order) {
      throw ApiError.notFound('Order not found');
    }
    res.status(200).json({ success: true, data: order });
  }
);
