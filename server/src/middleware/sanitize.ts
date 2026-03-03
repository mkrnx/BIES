/**
 * Input sanitization middleware.
 *
 * Strips HTML tags from string fields to prevent stored XSS.
 * Applied globally to all request bodies, query params, and URL params.
 *
 * Note: Does NOT encode for HTML — that's the frontend's responsibility.
 * This layer removes injection vectors at the ingress point.
 */

import { Request, Response, NextFunction } from 'express';

// Lightweight HTML tag stripper — applied recursively, handles nested tag reconstruction
function stripTags(str: string): string {
    let prev = '';
    let result = str;
    // Loop to handle nested/reconstructed tags (e.g. <scr<script>ipt>)
    while (result !== prev) {
        prev = result;
        result = result
            .replace(/<script[\s\S]*?<\/script>/gi, '')  // Remove script blocks
            .replace(/<style[\s\S]*?<\/style>/gi, '')     // Remove style blocks
            .replace(/<[^>]+>/g, '');                      // Remove remaining tags
    }
    return result;
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

// Fields that must never be sanitized (encrypted data and passwords)
// 'content' is intentionally NOT exempted — only 'encryptedPrivkey' and 'password' are,
// because content fields (articles, messages, updates) SHOULD be sanitized.
const EXEMPT_FIELDS = new Set(['encryptedPrivkey', 'password']);

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
        if (EXEMPT_FIELDS.has(key)) {
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
    // Sanitize query parameters (common XSS vector via reflected values)
    if (req.query && typeof req.query === 'object') {
        (req as any).query = sanitizeObject(req.query as Record<string, unknown>);
    }
    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
        (req as any).params = sanitizeObject(req.params as Record<string, unknown>) as Record<string, string>;
    }
    next();
}
