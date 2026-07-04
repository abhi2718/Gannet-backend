import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import {
  createAddress,
  deleteAddress,
  getAddress,
  listAddresses,
  updateAddress,
} from './controller';
import {
  addressIdParamSchema,
  createAddressSchema,
  listAddressesQuerySchema,
  updateAddressSchema,
} from './helpers';

const router = Router();

// Every address endpoint requires a valid JWT.
router.use(authenticate);

/**
 * @openapi
 * /api/addresses:
 *   get:
 *     tags: [Addresses]
 *     summary: List the current user's own addresses (paginated)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 20, maximum: 100, default: 20 }
 *     responses:
 *       200: { description: Paginated list of the caller's addresses }
 *   post:
 *     tags: [Addresses]
 *     summary: Create an address for the current user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [street, pinCode, city]
 *             properties:
 *               street: { type: string }
 *               pinCode: { type: string }
 *               city: { type: string }
 *               landmark: { type: string }
 *     responses:
 *       201: { description: Address created }
 */
router
  .route('/')
  .get(validate(listAddressesQuerySchema, 'query'), listAddresses)
  .post(validate(createAddressSchema), createAddress);

/**
 * @openapi
 * /api/addresses/{id}:
 *   get:
 *     tags: [Addresses]
 *     summary: Get an address (own for customers, any for admins)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The address }
 *       403: { description: Not your address }
 *       404: { description: Not found }
 *   patch:
 *     tags: [Addresses]
 *     summary: Update an address the caller owns
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
 *               street: { type: string }
 *               pinCode: { type: string }
 *               city: { type: string }
 *               landmark: { type: string }
 *     responses:
 *       200: { description: Updated address }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 *   delete:
 *     tags: [Addresses]
 *     summary: Delete an address the caller owns
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
  .get(validate(addressIdParamSchema, 'params'), getAddress)
  .patch(
    validate(addressIdParamSchema, 'params'),
    validate(updateAddressSchema),
    updateAddress
  )
  .delete(validate(addressIdParamSchema, 'params'), deleteAddress);

export default router;
