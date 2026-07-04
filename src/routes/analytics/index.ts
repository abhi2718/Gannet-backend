import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { UserType } from '../../models/user.model';
import {
  monthlyTrends,
  myOrderAnalytics,
  orderStatusBreakdown,
  summary,
} from './controller';
import { trendsQuerySchema } from './helpers';

const router = Router();

// Every analytics endpoint requires a valid JWT; dashboards additionally
// require admin (applied per-route below).
router.use(authenticate);

/**
 * @openapi
 * /api/analytics/my-orders:
 *   get:
 *     tags: [Analytics]
 *     summary: The current user's own order analytics
 *     responses:
 *       200:
 *         description: >-
 *           totalOrders, deliveredOrders, pendingOrders, outForDeliveryOrders
 *           and totalSpent (Σ quantity × amount) for the caller
 */
router.get('/my-orders', myOrderAnalytics);

/**
 * @openapi
 * /api/analytics/order-status:
 *   get:
 *     tags: [Analytics]
 *     summary: Count of orders in each status (admin only)
 *     responses:
 *       200:
 *         description: >-
 *           Map of every order status to its order count (pending, confirmed,
 *           out for delivery, delivered, cancelled)
 *       403: { description: Forbidden (not an admin) }
 */
router.get('/order-status', authorize(UserType.ADMIN), orderStatusBreakdown);

/**
 * @openapi
 * /api/analytics/summary:
 *   get:
 *     tags: [Analytics]
 *     summary: Platform totals (admin only)
 *     responses:
 *       200:
 *         description: >-
 *           totalOrders, pendingOrders, deliveredOrders (completed) and
 *           totalUsers
 *       403: { description: Forbidden (not an admin) }
 */
router.get('/summary', authorize(UserType.ADMIN), summary);

/**
 * @openapi
 * /api/analytics/monthly-trends:
 *   get:
 *     tags: [Analytics]
 *     summary: Monthly bookings & queries for plotting (admin only)
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer, minimum: 2000, maximum: 2100 }
 *         description: Optional — restrict both series to a single calendar year
 *     responses:
 *       200:
 *         description: >-
 *           `bookings` and `queries`, each an array of { year, month, count }
 *           sorted chronologically
 *       403: { description: Forbidden (not an admin) }
 */
router.get(
  '/monthly-trends',
  authorize(UserType.ADMIN),
  validate(trendsQuerySchema, 'query'),
  monthlyTrends
);

export default router;
