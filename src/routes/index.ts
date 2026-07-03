import { Router } from 'express';
import authRoutes from './auth';
import productRoutes from './product';
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

export default router;
