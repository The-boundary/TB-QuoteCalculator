import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { apiLimiter, authLimiter } from '../middleware/rateLimiter.js';
import authRoutes from './auth.js';
import healthRoutes from './health.js';
import rateCardRoutes from './rate-cards.js';
import quoteRoutes from './quotes.js';
import templateRoutes from './templates.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authLimiter, authRoutes);

// Protected routes below
router.use(apiLimiter);
router.use(requireAuth);
router.use('/rate-cards', rateCardRoutes);
router.use('/quotes', quoteRoutes);
router.use('/templates', templateRoutes);

export default router;
