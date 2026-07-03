import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from './controller';
import {
  createProductSchema,
  productIdParamSchema,
  updateProductSchema,
} from './helpers';

const router = Router();

// Every product endpoint requires a valid JWT.
router.use(authenticate);

/**
 * @openapi
 * /api/products:
 *   get:
 *     tags: [Products]
 *     summary: List all products
 *     responses:
 *       200: { description: Array of products }
 *   post:
 *     tags: [Products]
 *     summary: Create a product
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productName, url, price, description]
 *             properties:
 *               productName: { type: string }
 *               url: { type: string, format: uri }
 *               price: { type: number }
 *               description: { type: string }
 *     responses:
 *       201: { description: Product created }
 */
router
  .route('/')
  .get(listProducts)
  .post(validate(createProductSchema), createProduct);

/**
 * @openapi
 * /api/products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Get a product by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The product }
 *   patch:
 *     tags: [Products]
 *     summary: Update a product
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated product }
 *   delete:
 *     tags: [Products]
 *     summary: Delete a product
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 */
router
  .route('/:id')
  .get(validate(productIdParamSchema, 'params'), getProduct)
  .patch(
    validate(productIdParamSchema, 'params'),
    validate(updateProductSchema),
    updateProduct
  )
  .delete(validate(productIdParamSchema, 'params'), deleteProduct);

export default router;
