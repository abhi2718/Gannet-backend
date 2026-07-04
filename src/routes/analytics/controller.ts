import { Request, Response } from 'express';
import { Order, OrderStatus } from '../../models/order.model';
import { Query } from '../../models/query.model';
import { User } from '../../models/user.model';
import { catchAsync } from '../../utils/catchAsync';
import {
  denseCounts,
  emptyOrderStatusCounts,
  lastMonthFor,
  monthRange,
  monthlyPipeline,
  orderStatusPipeline,
} from './helpers';

/**
 * GET /api/analytics/order-status — admin. Number of orders in each status
 * (pending, confirmed, out for delivery, delivered, cancelled). Statuses with
 * no orders are returned as 0.
 */
export const orderStatusBreakdown = catchAsync(
  async (_req: Request, res: Response) => {
    const rows = await Order.aggregate(orderStatusPipeline());
    const counts = emptyOrderStatusCounts();
    for (const row of rows) {
      if (row._id in counts) counts[row._id] = row.count;
    }
    res.status(200).json({ success: true, data: counts });
  }
);

/**
 * GET /api/analytics/summary — admin. Platform totals: all orders, pending and
 * delivered (completed) orders, and total users.
 */
export const summary = catchAsync(async (_req: Request, res: Response) => {
  const [totalOrders, pendingOrders, deliveredOrders, totalUsers] =
    await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: OrderStatus.PENDING }),
      Order.countDocuments({ status: OrderStatus.DELIVERED }),
      User.countDocuments(),
    ]);

  res.status(200).json({
    success: true,
    data: { totalOrders, pendingOrders, deliveredOrders, totalUsers },
  });
});

/**
 * GET /api/analytics/monthly-trends — admin. Dense month-by-month series for a
 * year (default: the current year, Jan…current month; a past year → all 12
 * months). Returns a shared `months` axis plus `bookings` (orders) and `queries`
 * count arrays aligned to it, with 0 for months that have no data — ready to
 * plot month vs count.
 */
export const monthlyTrends = catchAsync(async (req: Request, res: Response) => {
  const now = new Date();
  const year = req.query.year ? Number(req.query.year) : now.getUTCFullYear();
  const lastMonth = lastMonthFor(year, now);

  const [bookingRows, queryRows] = await Promise.all([
    Order.aggregate(monthlyPipeline(year)),
    Query.aggregate(monthlyPipeline(year)),
  ]);

  res.status(200).json({
    success: true,
    data: {
      year,
      months: monthRange(lastMonth),
      bookings: denseCounts(bookingRows, lastMonth),
      queries: denseCounts(queryRows, lastMonth),
    },
  });
});
