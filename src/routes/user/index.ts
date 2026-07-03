import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { UserType } from '../../models/user.model';
import { deleteUser, getUser, listUsers, updateUser } from './controller';
import { updateUserSchema, userIdParamSchema } from './helpers';

const router = Router();

// Every user endpoint requires a valid JWT.
router.use(authenticate);

/**
 * @openapi
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: List all users
 *     responses:
 *       200: { description: Array of users }
 */
router.get('/', listUsers);

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
