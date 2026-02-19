import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { apiLimiter, authLimiter } from '../middleware/rateLimiter.js';
import authRoutes from './auth.js';
import rateCardRoutes from './rate-cards.js';
import quoteRoutes from './quotes.js';
import templateRoutes from './templates.js';

const router = Router();

// Health check (no auth)
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'quote-calculator',
  });
});

// Auth (no auth, rate limited)
router.use('/auth', authLimiter, authRoutes);

// Auth-protected routes below this line
router.use(apiLimiter);
router.use(requireAuth);
router.use('/rate-cards', rateCardRoutes);
router.use('/quotes', quoteRoutes);
router.use('/templates', templateRoutes);

export default router;
