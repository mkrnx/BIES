/**
 * Shared rate limiters for money-moving endpoints.
 *
 * The app-level `generalLimiter` (300 req / 15 min per IP in index.ts) is too
 * loose for endpoints that move real sats or brute-force a wallet credential.
 * `moneyLimiter` is a strict per-IP limiter (keyed per-IP via the default
 * key generator, exactly like generalLimiter/authLimiter) mounted directly on
 * the wallet payment/invoice/connect routes and the ticket pay/create routes.
 * Read-only endpoints (balance/transactions) stay on the general limiter.
 *
 * This closes the invoice-spam / payment-hammer / connect-brute-force gap.
 */
import rateLimit from 'express-rate-limit';

// Strict: 30 requests / 15 min per IP.
export const moneyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many wallet requests, please try again later' },
    skip: (req) => req.method === 'OPTIONS',
});
