import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import authRoutes from './auth.js';
import healthRoutes from './health.js';
import rateCardRoutes from './rate-cards.js';
import quoteRoutes from './quotes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);

// Protected routes below
router.use(requireAuth);
router.use('/rate-cards', rateCardRoutes);
router.use('/quotes', quoteRoutes);

export default router;
