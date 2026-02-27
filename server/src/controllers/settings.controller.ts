import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { z } from 'zod';

export const updateNotificationSettingsSchema = z.object({
    emailNotifications: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
    marketingEmails: z.boolean().optional(),
    notifyMessages: z.boolean().optional(),
    notifyInvestments: z.boolean().optional(),
    notifyFollows: z.boolean().optional(),
    notifyProjectUpdates: z.boolean().optional(),
});

export const updateRelaysSchema = z.object({
    relays: z.array(z.string().url()).min(0).max(20),
});

/**
 * GET /settings
 * Return current user's settings (auto-creates if not yet existing).
 */
export async function getSettings(req: Request, res: Response): Promise<void> {
    try {
        let settings = await prisma.userSettings.findUnique({
            where: { userId: req.user!.id },
        });

        if (!settings) {
            settings = await prisma.userSettings.create({
                data: { userId: req.user!.id },
            });
        }

        res.json({
            ...settings,
            relays: JSON.parse(settings.relays || '[]'),
        });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Failed to get settings' });
    }
}

/**
 * PUT /settings/notifications
 * Update notification preferences.
 */
export async function updateNotificationSettings(req: Request, res: Response): Promise<void> {
    try {
        const settings = await prisma.userSettings.upsert({
            where: { userId: req.user!.id },
            update: req.body,
            create: { userId: req.user!.id, ...req.body },
        });

        res.json({
            ...settings,
            relays: JSON.parse(settings.relays || '[]'),
        });
    } catch (error) {
        console.error('Update notification settings error:', error);
        res.status(500).json({ error: 'Failed to update notification settings' });
    }
}

/**
 * PUT /settings/relays
 * Update connected Nostr relay list.
 */
export async function updateRelays(req: Request, res: Response): Promise<void> {
    try {
        const { relays } = req.body;

        const settings = await prisma.userSettings.upsert({
            where: { userId: req.user!.id },
            update: { relays: JSON.stringify(relays) },
            create: { userId: req.user!.id, relays: JSON.stringify(relays) },
        });

        res.json({
            ...settings,
            relays: JSON.parse(settings.relays || '[]'),
        });
    } catch (error) {
        console.error('Update relays error:', error);
        res.status(500).json({ error: 'Failed to update relays' });
    }
}

/**
 * DELETE /settings/account
 * Delete user account. Prisma cascade handles all related records.
 */
export async function deleteAccount(req: Request, res: Response): Promise<void> {
    try {
        const userId = req.user!.id;

        await prisma.user.delete({
            where: { id: userId },
        });

        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
}
