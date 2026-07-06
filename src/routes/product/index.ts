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
  listProductsQuerySchema,
  productIdParamSchema,
  updateProductSchema,
} from './helpers';

const router = Router();

// Reading the catalogue is public (guests browse the landing page); creating,
// updating and deleting a product require a valid JWT (applied per-route below).

/**
 * @openapi
 * /api/products:
 *   get:
 *     tags: [Products]
 *     summary: List products (public; paginated, page size >= 20)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 20, maximum: 100, default: 20 }
 *     responses:
 *       200: { description: Paginated list of products }
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
  .get(validate(listProductsQuerySchema, 'query'), listProducts)
  .post(authenticate, validate(createProductSchema), createProduct);

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
    authenticate,
    validate(productIdParamSchema, 'params'),
    validate(updateProductSchema),
    updateProduct
  )
  .delete(authenticate, validate(productIdParamSchema, 'params'), deleteProduct);

export default router;
