// ======================
// USER TYPES
// ======================
// Espejo de `AccountUser` (apps/web/src/lib/supabase/server.ts), la fuente de
// verdad real del usuario en Project Hub. El shape anterior de este archivo
// (id/email/name/role genéricos) no correspondía al dominio real — nadie lo
// importaba, así que no había ningún consumidor que romper al corregirlo.

export type PermissionLevel = 'super_admin' | 'admin' | 'manager' | 'user' | 'viewer' | 'guest';

export interface User {
    id: string;
    email: string;
    username: string;
    displayName: string | null;
    firstName: string;
    lastNamePaternal: string;
    lastNameMaternal: string | null;
    permissionLevel: PermissionLevel;
    avatarUrl: string | null;
    createdAt: string;
    updatedAt: string;
}

// ======================
// API RESPONSE TYPES
// ======================

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        message: string;
        code: string;
        details?: unknown;
    };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

// ======================
// AUTH TYPES
// ======================
// El login real acepta email O username (ver `authenticateSofiaUser` en
// apps/web/src/lib/auth/sofia-auth.ts) — SOFIA es la fuente de verdad de auth,
// no un login por email puro.

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

export interface LoginCredentials {
    emailOrUsername: string;
    password: string;
}

export interface AuthResponse {
    user: User;
    accessToken: string;
    refreshToken: string;
}
