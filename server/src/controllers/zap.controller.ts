import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getProjectZapTotal } from '../services/zap.service';

/**
 * GET /api/zaps/project/:projectId
 * Paginated list of zap receipts for a project.
 */
export async function getProjectZaps(req: Request, res: Response): Promise<void> {
    try {
        const { projectId } = req.params;
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 50);
        const skip = (page - 1) * limit;

        const [zaps, total] = await Promise.all([
            prisma.zapReceipt.findMany({
                where: { projectId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.zapReceipt.count({ where: { projectId } }),
        ]);

        // Serialize BigInt amountMsats as string for JSON
        const data = zaps.map((z) => ({
            ...z,
            amountMsats: z.amountMsats.toString(),
        }));

        res.json({
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Get project zaps error:', error);
        res.status(500).json({ error: 'Failed to get project zaps' });
    }
}

/**
 * GET /api/zaps/user/:pubkey
 * Paginated list of zap receipts received by a user.
 */
export async function getUserZaps(req: Request, res: Response): Promise<void> {
    try {
        const { pubkey } = req.params;
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 50);
        const skip = (page - 1) * limit;

        const [zaps, total] = await Promise.all([
            prisma.zapReceipt.findMany({
                where: { recipientPubkey: pubkey },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.zapReceipt.count({ where: { recipientPubkey: pubkey } }),
        ]);

        const data = zaps.map((z) => ({
            ...z,
            amountMsats: z.amountMsats.toString(),
        }));

        res.json({
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Get user zaps error:', error);
        res.status(500).json({ error: 'Failed to get user zaps' });
    }
}

/**
 * GET /api/zaps/stats/:projectId
 * Aggregate stats: total sats, zap count, top zappers.
 */
export async function getProjectZapStats(req: Request, res: Response): Promise<void> {
    try {
        const { projectId } = req.params;

        const [totals, topZappers] = await Promise.all([
            getProjectZapTotal(projectId),
            prisma.zapReceipt.groupBy({
                by: ['senderPubkey'],
                where: { projectId },
                _sum: { amountSats: true },
                _count: true,
                orderBy: { _sum: { amountSats: 'desc' } },
                take: 10,
            }),
        ]);

        res.json({
            totalSats: totals.totalSats,
            zapCount: totals.zapCount,
            topZappers: topZappers.map((z) => ({
                pubkey: z.senderPubkey,
                totalSats: z._sum.amountSats || 0,
                zapCount: z._count,
            })),
        });
    } catch (error) {
        console.error('Get project zap stats error:', error);
        res.status(500).json({ error: 'Failed to get zap stats' });
    }
}
