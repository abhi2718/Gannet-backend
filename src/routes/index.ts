import { Router } from 'express';
import addressRoutes from './address';
import authRoutes from './auth';
import orderRoutes from './order';
import productRoutes from './product';
import queryRoutes from './query';
import userRoutes from './user';

const router = Router();

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [System]
 *     summary: Health check
 *     security: []
 *     responses:
 *       200: { description: Service is up }
 */
router.get('/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'gannet API is healthy' });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/queries', queryRoutes);
router.use('/addresses', addressRoutes);
router.use('/orders', orderRoutes);

export default router;
