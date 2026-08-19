import { z } from 'zod';

// Update user schema
export const updateUserSchema = z.object({
    body: z.object({
        name: z.string().min(2, 'El nombre debe tener mínimo 2 caracteres').optional(),
        email: z.email('Email inválido').optional(),
        avatar: z.url('URL inválida').optional(),
    }),
    params: z.object({
        id: z.string().min(1, 'ID de usuario requerido'),
    }),
});

// Get user by ID schema
export const getUserSchema = z.object({
    params: z.object({
        id: z.string().min(1, 'ID de usuario requerido'),
    }),
});

// Infer types
export type UpdateUserInput = z.infer<typeof updateUserSchema>['body'];
export type GetUserParams = z.infer<typeof getUserSchema>['params'];

// User type
export interface User {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'user' | 'guest';
    avatar?: string;
    createdAt: Date;
    updatedAt: Date;
}
