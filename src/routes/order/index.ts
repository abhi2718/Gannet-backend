import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { UserType } from '../../models/user.model';
import {
  createOrder,
  deleteOrder,
  getOrder,
  listAllOrders,
  listMyOrders,
  updateOrder,
  updateOrderStatus,
} from './controller';
import {
  createOrderSchema,
  listOrdersQuerySchema,
  orderIdParamSchema,
  updateOrderSchema,
  updateOrderStatusSchema,
} from './helpers';

const router = Router();

// Every order endpoint requires a valid JWT.
router.use(authenticate);

/**
 * @openapi
 * /api/orders:
 *   get:
 *     tags: [Orders]
 *     summary: List ALL orders (admin only; paginated, searchable, filterable)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 20, maximum: 100, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Term matched against customer name OR phone OR bottle size
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, out for delivery, delivered, cancelled]
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200: { description: Paginated list of all orders }
 *       403: { description: Forbidden (not an admin) }
 *   post:
 *     tags: [Orders]
 *     summary: Create an order for the current user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerName, customerPhone, bottleSize, quantity, amount]
 *             properties:
 *               customerName: { type: string }
 *               customerPhone: { type: string }
 *               bottleSize: { type: string }
 *               quantity: { type: integer, minimum: 1 }
 *               amount: { type: number, minimum: 0 }
 *               estimatedDelivery: { type: string, format: date-time }
 *     responses:
 *       201: { description: Order created }
 */
router
  .route('/')
  .get(
    authorize(UserType.ADMIN),
    validate(listOrdersQuerySchema, 'query'),
    listAllOrders
  )
  .post(validate(createOrderSchema), createOrder);

/**
 * @openapi
 * /api/orders/my:
 *   get:
 *     tags: [Orders]
 *     summary: List the current user's own orders (paginated, searchable)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 20, maximum: 100, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Term matched against customer name OR phone OR bottle size
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, out for delivery, delivered, cancelled]
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200: { description: Paginated list of the caller's orders }
 */
// Defined before '/:id' so the literal path is not captured as an id.
router.get('/my', validate(listOrdersQuerySchema, 'query'), listMyOrders);

/**
 * @openapi
 * /api/orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: Get an order (own for customers, any for admins)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The order }
 *       403: { description: Not your order }
 *       404: { description: Not found }
 *   patch:
 *     tags: [Orders]
 *     summary: Edit an order (admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customerName: { type: string }
 *               customerPhone: { type: string }
 *               bottleSize: { type: string }
 *               quantity: { type: integer, minimum: 1 }
 *               amount: { type: number, minimum: 0 }
 *               estimatedDelivery: { type: string, format: date-time }
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, out for delivery, delivered, cancelled]
 *     responses:
 *       200: { description: Updated order }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 *   delete:
 *     tags: [Orders]
 *     summary: Delete an order (admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 */
router
  .route('/:id')
  .get(validate(orderIdParamSchema, 'params'), getOrder)
  .patch(
    authorize(UserType.ADMIN),
    validate(orderIdParamSchema, 'params'),
    validate(updateOrderSchema),
    updateOrder
  )
  .delete(
    authorize(UserType.ADMIN),
    validate(orderIdParamSchema, 'params'),
    deleteOrder
  );

/**
 * @openapi
 * /api/orders/{id}/status:
 *   patch:
 *     tags: [Orders]
 *     summary: Update order status (admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, out for delivery, delivered, cancelled]
 *     responses:
 *       200: { description: Updated order }
 *       403: { description: Forbidden }
 */
router.patch(
  '/:id/status',
  authorize(UserType.ADMIN),
  validate(orderIdParamSchema, 'params'),
  validate(updateOrderStatusSchema),
  updateOrderStatus
);

export default router;
