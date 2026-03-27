/**
 * Wallet routes — Coinos custodial wallet management.
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import * as coinosService from '../services/coinos.service';

const router = Router();

// All wallet routes require authentication
router.use(authenticate);

/**
 * POST /api/wallet/coinos/create
 * Auto-provision a new Coinos wallet for the authenticated user.
 * Body: { username: string }
 */
router.post('/coinos/create', async (req: Request, res: Response) => {
    try {
        const username = req.body.username?.trim();
        if (!username || username.length < 2 || username.length > 24 || !/^[a-zA-Z0-9]+$/.test(username)) {
            res.status(400).json({ error: 'Username must be 2-24 alphanumeric characters' });
            return;
        }

        const result = await coinosService.createWallet(req.user!.id, username);
        res.json(result);
    } catch (err: any) {
        const msg = err.message || 'Failed to create Coinos wallet';
        const status = msg.includes('409') || msg.includes('already') ? 409 : 500;
        res.status(status).json({ error: msg });
    }
});

/**
 * POST /api/wallet/coinos/connect
 * Connect an existing Coinos account.
 * Body: { username: string, password: string }
 */
router.post('/coinos/connect', async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            res.status(400).json({ error: 'Username and password are required' });
            return;
        }

        const result = await coinosService.connectWallet(req.user!.id, username, password);
        res.json(result);
    } catch (err: any) {
        res.status(401).json({ error: err.message || 'Failed to connect Coinos wallet' });
    }
});

/**
 * POST /api/wallet/coinos/disconnect
 * Disconnect the Coinos wallet.
 */
router.post('/coinos/disconnect', async (req: Request, res: Response) => {
    try {
        await coinosService.disconnectWallet(req.user!.id);
        res.json({ ok: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message || 'Failed to disconnect' });
    }
});

/**
 * GET /api/wallet/coinos/balance
 * Get the current wallet balance in sats.
 */
router.get('/coinos/balance', async (req: Request, res: Response) => {
    try {
        const sats = await coinosService.getBalance(req.user!.id);
        res.json({ sats });
    } catch (err: any) {
        res.status(400).json({ error: err.message || 'Failed to fetch balance' });
    }
});

/**
 * POST /api/wallet/coinos/pay
 * Pay a BOLT-11 invoice from the Coinos wallet.
 * Body: { bolt11: string }
 */
router.post('/coinos/pay', async (req: Request, res: Response) => {
    try {
        const { bolt11 } = req.body;
        if (!bolt11) {
            res.status(400).json({ error: 'bolt11 invoice is required' });
            return;
        }

        const result = await coinosService.payInvoice(req.user!.id, bolt11);
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message || 'Payment failed' });
    }
});

export default router;
