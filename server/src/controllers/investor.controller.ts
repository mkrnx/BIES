import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { z } from 'zod';

const requestSchema = z.object({
    message: z.string().optional(),
});

/**
 * POST /investors/request
 * Submit an application for an investor role
 */
export async function requestInvestorRole(req: Request, res: Response): Promise<void> {
    try {
        const { message } = requestSchema.parse(req.body);

        if (req.user!.role === 'INVESTOR') {
            res.status(400).json({ error: 'You are already an Investor' });
            return;
        }

        const existing = await prisma.investorRequest.findFirst({
            where: {
                userId: req.user!.id,
                status: 'PENDING'
            }
        });

        if (existing) {
            res.status(400).json({ error: 'You already have a pending investor request' });
            return;
        }

        const request = await prisma.investorRequest.create({
            data: {
                userId: req.user!.id,
                message: message || '',
            }
        });

        res.status(201).json(request);
    } catch (error) {
        console.error('Request Investor Role error:', error);
        res.status(500).json({ error: 'Failed to request investor role' });
    }
}
