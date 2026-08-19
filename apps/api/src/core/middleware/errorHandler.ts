import { Request, Response, NextFunction } from 'express';

/**
 * Custom Application Error class
 */
export class AppError extends Error {
    constructor(
        public message: string,
        public statusCode: number = 500,
        public code: string = 'INTERNAL_ERROR'
    ) {
        super(message);
        this.name = 'AppError';
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Factory function to create AppError instances
 */
export const createError = (
    message: string,
    statusCode: number,
    code: string
): AppError => {
    return new AppError(message, statusCode, code);
};

/**
 * Global error handler middleware
 */
export const errorHandler = (
    err: Error | AppError,
    _req: Request,
    res: Response,
    _next: NextFunction
): void => {
    // Log error for debugging
    console.error('Error:', err);

    // Handle known AppError
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: {
                message: err.message,
                code: err.code,
            },
        });
        return;
    }

    // Handle Zod validation errors
    if (err.name === 'ZodError') {
        res.status(400).json({
            success: false,
            error: {
                message: 'Error de validación',
                code: 'VALIDATION_ERROR',
                details: (err as any).issues,
            },
        });
        return;
    }

    // Handle unknown errors
    res.status(500).json({
        success: false,
        error: {
            message: 'Error interno del servidor',
            code: 'INTERNAL_ERROR',
        },
    });
};

/**
 * Async handler wrapper to catch async errors
 */
export const asyncHandler = (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
