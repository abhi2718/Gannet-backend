import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import { queryRateLimiter } from '../../middlewares/rateLimiter';
import { validate } from '../../middlewares/validate';
import { UserType } from '../../models/user.model';
import { createQuery, listQueries } from './controller';
import { createQuerySchema, listQueriesQuerySchema } from './helpers';

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
 *     summary: List submitted enquiries (admin only, paginated)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 20, maximum: 100, default: 20 }
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

export default router;
