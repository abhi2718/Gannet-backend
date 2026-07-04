import { Request, Response } from 'express';
import { Address } from '../../models/address.model';
import { Order } from '../../models/order.model';
import { IUser, UserType } from '../../models/user.model';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import { buildAdminOrderPipeline, buildOrderFilter } from './helpers';

const buildPagination = (total: number, page: number, limit: number) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});

/**
 * POST /api/orders — create an order owned by the current user. The referenced
 * address must exist and belong to the caller.
 */
export const createOrder = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const address = await Address.findOne({
    _id: req.body.address,
    user: user.id,
  });
  if (!address) {
    throw ApiError.badRequest('address not found or does not belong to you');
  }
  const order = await Order.create({ ...req.body, user: user.id });
  res.status(201).json({ success: true, data: order });
});

/**
 * GET /api/orders/my — the current user's own orders (searchable, paginated).
 * The delivery address is populated so the caller sees where it ships.
 */
export const listMyOrders = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const page = Number(req.query.page);
  const limit = Number(req.query.limit);
  const skip = (page - 1) * limit;
  const filter = { user: user.id, ...buildOrderFilter(req.query) };

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('address'),
    Order.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: orders.length,
    pagination: buildPagination(total, page, limit),
    data: orders,
  });
});

/**
 * GET /api/orders — every order (admin only). Joins the user and address so the
 * admin sees who placed each order (name/phone/email) and where, and can search
 * across all of those fields plus filter by status and date. Paginated.
 */
export const listAllOrders = catchAsync(async (req: Request, res: Response) => {
  const page = Number(req.query.page);
  const limit = Number(req.query.limit);
  const skip = (page - 1) * limit;

  const pipeline = buildAdminOrderPipeline(req.query, { skip, limit });
  const [facet] = await Order.aggregate(pipeline);
  const data = facet?.data ?? [];
  const total = facet?.totalCount?.[0]?.count ?? 0;

  res.status(200).json({
    success: true,
    count: data.length,
    pagination: buildPagination(total, page, limit),
    data,
  });
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
