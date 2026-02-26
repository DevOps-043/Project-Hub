'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// API Configuration
const API_BASE_URL = '/api';

// Types
interface User {
    id: string;
    email: string;
    name: string;
    firstName?: string;
    lastName?: string;
    role: 'admin' | 'user' | 'guest';
    permissionLevel?: string;
    companyRole?: string;
    department?: string;
    avatar?: string;
    isEmailVerified?: boolean;
    timezone?: string;
    locale?: string;
    createdAt: Date;
    updatedAt: Date;
    sofiaUserId?: string;
}

export interface WorkspaceInfo {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string;
    role: string;
}

interface LoginCredentials {
    email: string;
    password: string;
}

interface RegisterData {
    firstName: string;
    lastNamePaternal: string;
    lastNameMaternal?: string;
    email: string;
    password: string;
    username: string;
}

interface AuthState {
    // State
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    isInitialized: boolean;
    error: string | null;
    authSource: 'sofia' | 'local' | null;
    workspaces: WorkspaceInfo[];
    lockoutTimer: number;

    // Actions
    login: (credentials: LoginCredentials) => Promise<void>;
    register: (data: RegisterData) => Promise<void>;
    logout: () => Promise<void>;
    refreshToken: () => Promise<boolean>;
    fetchCurrentUser: () => Promise<void>;
    clearError: () => void;
    setUser: (user: User | null) => void;
    setWorkspaces: (workspaces: WorkspaceInfo[]) => void;
    setLockoutTimer: (seconds: number) => void;
    initialize: () => Promise<void>;
}

// Helper para obtener token
const getAccessToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
};

const getRefreshToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refreshToken');
};

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            // Initial state
            user: null,
            isAuthenticated: false,
            isLoading: false,
            isInitialized: false,
            error: null,
            authSource: null,
            workspaces: [],
            lockoutTimer: 0,

            // Initialize - verificar sesión existente al cargar la app
            initialize: async () => {
                const token = getAccessToken();

                if (!token) {
                    localStorage.removeItem('auth-storage');
                    set({ isInitialized: true, isAuthenticated: false, user: null, workspaces: [] });
                    return;
                }

                try {
                    await get().fetchCurrentUser();
                    set({ isInitialized: true });
                } catch {
                    const refreshed = await get().refreshToken();
                    if (!refreshed) {
                        localStorage.removeItem('accessToken');
                        localStorage.removeItem('refreshToken');
                        localStorage.removeItem('auth-storage');
                        set({ isAuthenticated: false, user: null, isInitialized: true, workspaces: [] });
                        return;
                    }
                    set({ isInitialized: true });
                }
            },

            // Login action
            login: async (credentials: LoginCredentials) => {
                set({ isLoading: true, error: null });
                try {
                    const res = await fetch(`${API_BASE_URL}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(credentials),
                    });

                    const data = await res.json();

                    if (!res.ok) {
                        if (res.status === 423 && data.lockoutSeconds) {
                            set({ lockoutTimer: data.lockoutSeconds, isLoading: false });
                        }
                        throw new Error(data.error || 'Error al iniciar sesión');
                    }

                    localStorage.setItem('accessToken', data.accessToken);
                    localStorage.setItem('refreshToken', data.refreshToken);

                    set({
                        user: data.user,
                        isAuthenticated: true,
                        isLoading: false,
                        error: null,
                        authSource: data.authSource || 'local',
                        workspaces: data.workspaces || [],
                        lockoutTimer: 0, // Resetear al entrar
                    });
                } catch (error: unknown) {
                    // Ver si el error es de tipo lockout
                    // El manejo de 423 ya se hace en el bloque `if (!res.ok)`
                    // Si se lanza un error desde allí, se capturará aquí.
                    const errorMessage =
                        error instanceof Error ? error.message : 'Error al iniciar sesión';
                    set({
                        isLoading: false,
                        error: errorMessage,
                        isAuthenticated: false,
                    });
                    throw error;
                }
            },

            // Register action
            register: async (data: RegisterData) => {
                set({ isLoading: true, error: null });
                try {
                    const res = await fetch(`${API_BASE_URL}/auth/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data),
                    });

                    const responseData = await res.json();

                    if (!res.ok) {
                        throw new Error(responseData.error || 'Error al registrarse');
                    }

                    localStorage.setItem('accessToken', responseData.accessToken);
                    localStorage.setItem('refreshToken', responseData.refreshToken);

                    set({
                        user: responseData.user,
                        isAuthenticated: true,
                        isLoading: false,
                        error: null,
                    });
                } catch (error: unknown) {
                    const errorMessage =
                        error instanceof Error ? error.message : 'Error al registrarse';
                    set({
                        isLoading: false,
                        error: errorMessage,
                        isAuthenticated: false,
                    });
                    throw error;
                }
            },

            // Logout action
            logout: async () => {
                const token = getAccessToken();

                if (token) {
                    try {
                        await fetch(`${API_BASE_URL}/auth/logout`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json',
                            },
                        });
                    } catch (error) {
                        console.error('Error al cerrar sesión en servidor:', error);
                    }
                }

                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                set({
                    user: null,
                    isAuthenticated: false,
                    isLoading: false,
                    error: null,
                    authSource: null,
                    workspaces: [],
                });
            },

            // Refresh token
            refreshToken: async (): Promise<boolean> => {
                const refreshTokenValue = getRefreshToken();

                if (!refreshTokenValue) {
                    return false;
                }

                try {
                    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ refreshToken: refreshTokenValue }),
                    });

                    if (!res.ok) {
                        return false;
                    }

                    const data = await res.json();

                    localStorage.setItem('accessToken', data.accessToken);
                    localStorage.setItem('refreshToken', data.refreshToken);

                    await get().fetchCurrentUser();

                    return true;
                } catch (error) {
                    console.error('Error al renovar token:', error);
                    return false;
                }
            },

            // Fetch current user
            fetchCurrentUser: async () => {
                const token = getAccessToken();

                if (!token) {
                    set({ isAuthenticated: false, user: null });
                    return;
                }

                try {
                    const res = await fetch(`${API_BASE_URL}/auth/me`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                    });

                    if (!res.ok) {
                        if (res.status === 401) {
                            const refreshed = await get().refreshToken();
                            if (!refreshed) {
                                throw new Error('Sesión expirada');
                            }
                            return;
                        }
                        throw new Error('Error al obtener usuario');
                    }

                    const userData = await res.json();

                    set({
                        user: {
                            ...userData,
                            createdAt: new Date(userData.createdAt),
                            updatedAt: new Date(userData.updatedAt),
                        },
                        isAuthenticated: true,
                    });
                } catch (error) {
                    console.error('Error al obtener usuario:', error);
                    set({ isAuthenticated: false, user: null });
                    throw error;
                }
            },

            clearError: () => set({ error: null }),

            setUser: (user: User | null) =>
                set({
                    user,
                    isAuthenticated: !!user,
                }),

            setWorkspaces: (workspaces: WorkspaceInfo[]) =>
                set({ workspaces }),

            setLockoutTimer: (seconds: number) =>
                set({ lockoutTimer: Math.max(0, seconds) }),
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
                authSource: state.authSource,
                workspaces: state.workspaces,
                lockoutTimer: state.lockoutTimer,
            }),
        }
    )
);
