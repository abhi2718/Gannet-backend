import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { UserType } from '../../models/user.model';
import { deleteUser, getUser, listUsers, updateUser } from './controller';
import {
  listUsersQuerySchema,
  updateUserSchema,
  userIdParamSchema,
} from './helpers';

const router = Router();

// Every user endpoint requires a valid JWT.
router.use(authenticate);

/**
 * @openapi
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: List users (admin only; paginated, searchable, filterable)
 *     description: >-
 *       Returns each user's name, email, phone, cities (from their addresses),
 *       join date (createdAt), order count and status.
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
 *         description: >-
 *           Term matched against name OR email OR phone OR any city; an integer
 *           term also matches the exact order count
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, inactive] }
 *     responses:
 *       200: { description: Paginated list of users }
 *       403: { description: Forbidden (not an admin) }
 */
router.get(
  '/',
  authorize(UserType.ADMIN),
  validate(listUsersQuerySchema, 'query'),
  listUsers
);

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get a user by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The user }
 *       404: { description: Not found }
 */
router.get('/:id', validate(userIdParamSchema, 'params'), getUser);

/**
 * @openapi
 * /api/users/{id}:
 *   patch:
 *     tags: [Users]
 *     summary: Update a user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated user }
 */
router.patch(
  '/:id',
  validate(userIdParamSchema, 'params'),
  validate(updateUserSchema),
  updateUser
);

/**
 * @openapi
 * /api/users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Delete a user (admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 */
router.delete(
  '/:id',
  authorize(UserType.ADMIN),
  validate(userIdParamSchema, 'params'),
  deleteUser
);

export default router;
