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
            preferences: JSON.parse(settings.preferences || '{}'),
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
        // Explicitly pick allowed fields to prevent mass assignment
        const allowedFields = ['emailNotifications', 'pushNotifications', 'marketingEmails', 'notifyMessages', 'notifyInvestments', 'notifyFollows', 'notifyProjectUpdates'];
        const data: any = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) data[field] = req.body[field];
        }

        const settings = await prisma.userSettings.upsert({
            where: { userId: req.user!.id },
            update: data,
            create: { userId: req.user!.id, ...data },
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

export const updateMediaReadSchema = z.object({
    watched: z.array(z.string()).optional(),
    read: z.array(z.string()).optional(),
});

/**
 * GET /settings/media-read
 */
export async function getMediaRead(req: Request, res: Response): Promise<void> {
    try {
        const settings = await prisma.userSettings.findUnique({ where: { userId: req.user!.id } });
        const data = JSON.parse(settings?.mediaReadItems || '{}');
        res.json({ watched: data.watched || [], read: data.read || [] });
    } catch (error) {
        console.error('Get media read error:', error);
        res.status(500).json({ error: 'Failed to get media read state' });
    }
}

/**
 * PUT /settings/media-read
 */
export async function updateMediaRead(req: Request, res: Response): Promise<void> {
    try {
        const { watched, read } = req.body;
        const settings = await prisma.userSettings.findUnique({ where: { userId: req.user!.id } });
        const current = JSON.parse(settings?.mediaReadItems || '{}');

        const updated = {
            watched: watched !== undefined ? watched : (current.watched || []),
            read: read !== undefined ? read : (current.read || []),
        };

        await prisma.userSettings.upsert({
            where: { userId: req.user!.id },
            update: { mediaReadItems: JSON.stringify(updated) },
            create: { userId: req.user!.id, mediaReadItems: JSON.stringify(updated) },
        });

        res.json(updated);
    } catch (error) {
        console.error('Update media read error:', error);
        res.status(500).json({ error: 'Failed to update media read state' });
    }
}

export const updatePreferencesSchema = z.object({
    theme: z.string().optional(),
    language: z.string().optional(),
    projectsView: z.string().optional(),
    membersView: z.string().optional(),
    eventsView: z.string().optional(),
    mediaView: z.string().optional(),
    defaultView: z.string().optional(),
}).passthrough();

/**
 * GET /settings/preferences
 */
export async function getPreferences(req: Request, res: Response): Promise<void> {
    try {
        const settings = await prisma.userSettings.findUnique({ where: { userId: req.user!.id } });
        res.json(JSON.parse(settings?.preferences || '{}'));
    } catch (error) {
        console.error('Get preferences error:', error);
        res.status(500).json({ error: 'Failed to get preferences' });
    }
}

/**
 * PUT /settings/preferences
 */
export async function updatePreferences(req: Request, res: Response): Promise<void> {
    try {
        const settings = await prisma.userSettings.findUnique({ where: { userId: req.user!.id } });
        const current = JSON.parse(settings?.preferences || '{}');
        const merged = { ...current, ...req.body };

        await prisma.userSettings.upsert({
            where: { userId: req.user!.id },
            update: { preferences: JSON.stringify(merged) },
            create: { userId: req.user!.id, preferences: JSON.stringify(merged) },
        });

        res.json(merged);
    } catch (error) {
        console.error('Update preferences error:', error);
        res.status(500).json({ error: 'Failed to update preferences' });
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
