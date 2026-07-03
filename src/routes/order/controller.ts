import { Request, Response } from 'express';
import { Order } from '../../models/order.model';
import { IUser, UserType } from '../../models/user.model';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';

// Escape user input before using it in a regex to avoid regex injection/ReDoS.
const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Build the search/filter portion of an order query: a single `search` term
 * matched (case-insensitively) against customerName OR customerPhone OR
 * bottleSize, an exact `status`, and a `dateFrom`/`dateTo` range on createdAt.
 */
const buildOrderFilter = (q: Request['query']): Record<string, unknown> => {
  const filter: Record<string, unknown> = {};

  if (q.search) {
    const rx = { $regex: escapeRegex(String(q.search)), $options: 'i' };
    filter.$or = [
      { customerName: rx },
      { customerPhone: rx },
      { bottleSize: rx },
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

/**
 * POST /api/orders — create an order owned by the current user.
 */
export const createOrder = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const order = await Order.create({ ...req.body, user: user.id });
  res.status(201).json({ success: true, data: order });
});

// Shared paginated responder; `base` scopes ownership, merged with search/filter.
const respondWithPaginatedOrders = async (
  base: Record<string, unknown>,
  req: Request,
  res: Response
): Promise<void> => {
  const page = Number(req.query.page);
  const limit = Number(req.query.limit);
  const skip = (page - 1) * limit;
  const filter = { ...base, ...buildOrderFilter(req.query) };

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
 * GET /api/orders/my — the current user's own orders (searchable, paginated).
 */
export const listMyOrders = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  await respondWithPaginatedOrders({ user: user.id }, req, res);
});

/**
 * GET /api/orders — every order (admin only; searchable, paginated).
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
  if (user.userType !== UserType.ADMIN && order.user.toString() !== user.id) {
    throw ApiError.forbidden('You can only access your own orders');
  }
  res.status(200).json({ success: true, data: order });
});

/**
 * PATCH /api/orders/:id — admin edits any order fields (incl. status).
 */
export const updateOrder = catchAsync(async (req: Request, res: Response) => {
  const order = await Order.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!order) {
    throw ApiError.notFound('Order not found');
  }
  res.status(200).json({ success: true, data: order });
});

/**
 * PATCH /api/orders/:id/status — admin-only status transition (status only).
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

/**
 * DELETE /api/orders/:id — admin deletes an order.
 */
export const deleteOrder = catchAsync(async (req: Request, res: Response) => {
  const order = await Order.findByIdAndDelete(req.params.id);
  if (!order) {
    throw ApiError.notFound('Order not found');
  }
  res.status(200).json({ success: true, data: null });
});
