/**
 * Cache middleware — wraps GET endpoints with Redis/in-memory caching.
 *
 * Usage:
 *   router.get('/path', cacheMiddleware(60), handler)
 *
 * The cache key is built from the request path + sorted query string.
 * Any write operations (POST/PUT/DELETE) that should bust the cache
 * must call cache.delPattern() from their controllers.
 */

import { Request, Response, NextFunction } from 'express';
import { cache } from '../services/redis.service';

/**
 * Returns an Express middleware that caches responses for `ttlSeconds`.
 */
export function cacheMiddleware(ttlSeconds: number) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // Only cache GET requests
        if (req.method !== 'GET') { next(); return; }

        // Build a stable cache key from path + sorted query params
        const queryStr = Object.keys(req.query)
            .sort()
            .map((k) => `${k}=${req.query[k]}`)
            .join('&');
        const key = `http:${req.path}${queryStr ? '?' + queryStr : ''}`;

        const cached = await cache.get(key);
        if (cached) {
            res.setHeader('X-Cache', 'HIT');
            res.setHeader('Content-Type', 'application/json');
            res.send(cached);
            return;
        }

        // Intercept res.json to cache the response
        const originalJson = res.json.bind(res);
        res.json = (body: unknown) => {
            cache.set(key, JSON.stringify(body), ttlSeconds).catch(() => {});
            res.setHeader('X-Cache', 'MISS');
            return originalJson(body);
        };

        next();
    };
}
