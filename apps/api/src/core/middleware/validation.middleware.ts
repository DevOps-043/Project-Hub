import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { createError } from './errorHandler';

/**
 * Validation middleware factory
 * Creates middleware that validates request against a Zod schema
 * 
 * @param schema - Zod schema to validate against
 * @returns Express middleware
 */
export const validate = (schema: ZodSchema) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
        try {
            schema.parse({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const firstError = error.issues[0];
                throw createError(
                    firstError.message,
                    400,
                    'VALIDATION_ERROR'
                );
            }
            throw error;
        }
    };
};
