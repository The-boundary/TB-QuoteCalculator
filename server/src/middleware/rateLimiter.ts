import rateLimit from 'express-rate-limit';

/** General API rate limiter — 100 requests per minute per IP */
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests, please try again later' } },
});

/** Stricter limiter for auth endpoints — 15 requests per minute per IP */
export const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many auth requests, please try again later' } },
});
