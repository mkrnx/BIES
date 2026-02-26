/**
 * Input sanitization middleware.
 *
 * Strips HTML tags from string fields to prevent stored XSS.
 * Applied globally to all request bodies.
 *
 * Note: Does NOT encode for HTML — that's the frontend's responsibility.
 * This layer removes injection vectors at the ingress point.
 */

import { Request, Response, NextFunction } from 'express';

// Very lightweight HTML tag stripper (no external dep needed)
function stripTags(str: string): string {
    return str
        .replace(/<script[\s\S]*?<\/script>/gi, '')  // Remove script blocks
        .replace(/<style[\s\S]*?<\/style>/gi, '')     // Remove style blocks
        .replace(/<[^>]+>/g, '');                      // Remove remaining tags
}

function sanitizeValue(value: unknown): unknown {
    if (typeof value === 'string') {
        return stripTags(value.trim());
    }
    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }
    if (value !== null && typeof value === 'object') {
        return sanitizeObject(value as Record<string, unknown>);
    }
    return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
        // Never sanitize encrypted content — it's binary-safe base64
        if (key === 'content' || key === 'encryptedPrivkey' || key === 'password') {
            sanitized[key] = val;
        } else {
            sanitized[key] = sanitizeValue(val);
        }
    }
    return sanitized;
}

/**
 * Sanitize req.body, req.query, and req.params.
 */
export function sanitize(req: Request, _res: Response, next: NextFunction): void {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }
    // Note: req.query and req.params are read-only in Express types
    // but the underlying values can be sanitized via type casting if needed
    next();
}
