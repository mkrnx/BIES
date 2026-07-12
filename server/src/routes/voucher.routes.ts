import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
    createVoucher,
    createVoucherSchema,
    listVouchers,
    listVoucherRedemptions,
    revokeVoucher,
    revokeRedemption,
    revokeVoucherSchema,
    getVoucherInfo,
    redeemVoucher,
    redeemVoucherSchema,
    getRedemptionStatus,
} from '../controllers/voucher.controller';

const router = Router();

// ─── Rate limiters (public voucher-link endpoints) ────────────────────────────
// Info + status: 120 per minute per IP (the redeem page polls invoice status)
const voucherInfoLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    message: { error: 'Too many requests, please try again later' },
});

// Redeem: 10 per 15 min per IP (whitelist writes + invoice creation)
const voucherRedeemLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many redemption attempts, please try again later' },
});

// Public routes (no auth — shared voucher links)
router.get('/code/:code', voucherInfoLimiter, getVoucherInfo);
router.post('/code/:code/redeem', voucherRedeemLimiter, validate(redeemVoucherSchema), redeemVoucher);
router.get('/redemptions/:id/status', voucherInfoLimiter, getRedemptionStatus);

// Admin routes — ADMIN only, not MOD. Voucher codes are bearer secrets: anyone
// who can read a free RELAY_ACCESS code can whitelist arbitrary pubkeys via the
// public redeem endpoint, so the read paths are as sensitive as create/revoke.
router.post('/', authenticate, requireRole('ADMIN'), validate(createVoucherSchema), createVoucher);
router.get('/', authenticate, requireRole('ADMIN'), listVouchers);
router.get('/:id/redemptions', authenticate, requireRole('ADMIN'), listVoucherRedemptions);
router.post('/:id/revoke', authenticate, requireRole('ADMIN'), validate(revokeVoucherSchema), revokeVoucher);
router.post('/redemptions/:id/revoke', authenticate, requireRole('ADMIN'), validate(revokeVoucherSchema), revokeRedemption);

export default router;
