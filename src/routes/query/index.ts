import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import { queryRateLimiter } from '../../middlewares/rateLimiter';
import { validate } from '../../middlewares/validate';
import { UserType } from '../../models/user.model';
import {
  createQuery,
  deleteQuery,
  listQueries,
  updateQuery,
} from './controller';
import {
  createQuerySchema,
  listQueriesQuerySchema,
  queryIdParamSchema,
  updateQuerySchema,
} from './helpers';

const router = Router();

/**
 * @openapi
 * /api/queries:
 *   post:
 *     tags: [Queries]
 *     summary: Submit an enquiry (public, no auth, rate limited)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, mobileNumber, email, city, requirement, message]
 *             properties:
 *               fullName: { type: string }
 *               mobileNumber: { type: string }
 *               email: { type: string, format: email }
 *               city: { type: string }
 *               requirement: { type: string, maxLength: 120 }
 *               message: { type: string, maxLength: 2000 }
 *     responses:
 *       201: { description: Query submitted }
 *       400: { description: Validation error }
 *       429: { description: Too many submissions }
 */
router.post('/', queryRateLimiter, validate(createQuerySchema), createQuery);

/**
 * @openapi
 * /api/queries:
 *   get:
 *     tags: [Queries]
 *     summary: List enquiries (admin only, paginated, searchable, filterable)
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
 *         description: Free-text term matched against name OR mobile OR email OR city
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [new, contacted, converted] }
 *     responses:
 *       200: { description: Paginated list of queries }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get(
  '/',
  authenticate,
  authorize(UserType.ADMIN),
  validate(listQueriesQuerySchema, 'query'),
  listQueries
);

/**
 * @openapi
 * /api/queries/{id}:
 *   patch:
 *     tags: [Queries]
 *     summary: Edit a query / update its status (admin only)
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
 *               fullName: { type: string }
 *               mobileNumber: { type: string }
 *               email: { type: string, format: email }
 *               city: { type: string }
 *               requirement: { type: string }
 *               message: { type: string }
 *               status: { type: string, enum: [new, contacted, converted] }
 *     responses:
 *       200: { description: Updated query }
 *       404: { description: Not found }
 *   delete:
 *     tags: [Queries]
 *     summary: Delete a query (admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 *       404: { description: Not found }
 */
router
  .route('/:id')
  .patch(
    authenticate,
    authorize(UserType.ADMIN),
    validate(queryIdParamSchema, 'params'),
    validate(updateQuerySchema),
    updateQuery
  )
  .delete(
    authenticate,
    authorize(UserType.ADMIN),
    validate(queryIdParamSchema, 'params'),
    deleteQuery
  );

export default router;
