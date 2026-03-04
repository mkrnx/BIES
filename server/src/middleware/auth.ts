import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import prisma from '../lib/prisma';
import { cache } from '../services/redis.service';

// Extend Express Request to include user info
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string | null;
                nostrPubkey: string;
                role: string;
            };
        }
    }
}

interface JwtPayload {
    userId: string;
    role: string;
}

/**
 * Verify JWT and attach user to request.
 * Returns 401 if token is missing or invalid.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid authorization header' });
        return;
    }

    const token = authHeader.split(' ')[1];

    // Check if token has been blacklisted (logout)
    const isBlacklisted = await cache.get(`blacklist:${token}`);
    if (isBlacklisted) {
        res.status(401).json({ error: 'Token has been revoked' });
        return;
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                nostrPubkey: true,
                role: true,
            },
        });

        if (!user) {
            res.status(401).json({ error: 'User not found' });
            return;
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

/**
 * Optional auth — attaches user if token is present, but doesn't fail if not.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        next();
        return;
    }

    try {
        const token = authHeader.split(' ')[1];

        const isBlacklisted = await cache.get(`blacklist:${token}`);
        if (isBlacklisted) {
            next();
            return;
        }

        const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                nostrPubkey: true,
                role: true,
            },
        });

        if (user) {
            req.user = user;
        }
    } catch {
        // Silently continue without user
    }

    next();
}

/**
 * Require specific role(s). Must be used AFTER authenticate middleware.
 */
export function requireRole(...roles: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        if (!roles.includes(req.user.role)) {
            res.status(403).json({ error: `Requires one of: ${roles.join(', ')}` });
            return;
        }

        next();
    };
}

/**
 * Generate JWT for a user.
 */
export function generateToken(userId: string, role: string): string {
    return jwt.sign({ userId, role }, config.jwtSecret, {
        algorithm: 'HS256',
        expiresIn: config.jwtExpiresIn,
    } as jwt.SignOptions);
}
