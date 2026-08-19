import { z } from 'zod';

// Login schema
export const loginSchema = z.object({
    body: z.object({
        email: z.email('Email inválido'),
        password: z.string().min(6, 'La contraseña debe tener mínimo 6 caracteres'),
    }),
});

// Register schema
export const registerSchema = z.object({
    body: z.object({
        name: z.string().min(2, 'El nombre debe tener mínimo 2 caracteres'),
        email: z.email('Email inválido'),
        password: z.string().min(6, 'La contraseña debe tener mínimo 6 caracteres'),
    }),
});

// Refresh token schema
export const refreshTokenSchema = z.object({
    body: z.object({
        refreshToken: z.string().min(1, 'Refresh token requerido'),
    }),
});

// Infer types from schemas
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>['body'];

// User type
export interface User {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'user' | 'guest';
    createdAt: Date;
    updatedAt: Date;
}

// Auth tokens type
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

// Auth response type
export interface AuthResponse {
    user: User;
    accessToken: string;
    refreshToken: string;
}
