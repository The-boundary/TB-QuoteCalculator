import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { apiLimiter, authLimiter } from '../middleware/rateLimiter.js';
import authRoutes from './auth.js';
import healthRoutes from './health.js';
import rateCardRoutes from './rate-cards.js';
import quoteRoutes from './quotes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authLimiter, authRoutes);

// Protected routes below
router.use(apiLimiter);
router.use(requireAuth);
router.use('/rate-cards', rateCardRoutes);
router.use('/quotes', quoteRoutes);

export default router;
