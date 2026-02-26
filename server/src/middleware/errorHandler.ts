import { Request, Response, NextFunction } from 'express';

interface AppError extends Error {
    statusCode?: number;
    code?: string;
}

/**
 * Global error handler. Catches all unhandled errors and returns consistent JSON.
 */
export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction): void {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

    if (process.env.NODE_ENV === 'development') {
        console.error(err.stack);
    }

    // Prisma unique constraint violation
    if (err.code === 'P2002') {
        res.status(409).json({
            error: 'A record with this value already exists',
        });
        return;
    }

    // Prisma record not found
    if (err.code === 'P2025') {
        res.status(404).json({
            error: 'Record not found',
        });
        return;
    }

    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        error: statusCode === 500 ? 'Internal server error' : err.message,
    });
}
