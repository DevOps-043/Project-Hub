'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api/client';

interface GoogleConnectionState {
  isConnected: boolean;
  isLoading: boolean;
  googleEmail: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  scopes: string[] | null;
}

export async function startGoogleConnection(returnUrl?: string): Promise<void> {
  const token = localStorage.getItem('accessToken');
  if (!token) {
    throw new Error('Sesion no disponible. Inicia sesion nuevamente.');
  }

  const { data, error } = await api.post<{ url?: string }>('/api/auth/google/connect', {
    returnUrl: returnUrl || window.location.pathname,
  });

  if (error || !data?.url) {
    throw new Error(error || 'No se pudo iniciar la conexion con Google');
  }

  window.location.href = data.url;
}

/**
 * Hook para gestionar la conexión de Google OAuth del usuario.
 * Verifica el estado de conexión y proporciona funciones para conectar/desconectar.
 */
export function useGoogleConnection() {
  const [state, setState] = useState<GoogleConnectionState>({
    isConnected: false,
    isLoading: true,
    googleEmail: null,
    displayName: null,
    avatarUrl: null,
    scopes: null,
  });

  const checkStatus = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const { data, error } = await api.get<{ connected: boolean; email?: string; displayName?: string; avatarUrl?: string; scopes?: string[] }>('/api/auth/google/status');

      if (error || !data) {
        setState(prev => ({ ...prev, isConnected: false, isLoading: false }));
        return;
      }

      setState({
        isConnected: data.connected,
        isLoading: false,
        googleEmail: data.email || null,
        displayName: data.displayName || null,
        avatarUrl: data.avatarUrl || null,
        scopes: data.scopes || null,
      });
    } catch {
      setState(prev => ({ ...prev, isConnected: false, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Detectar retorno de OAuth (google_connected=true en URL)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected') === 'true') {
      // Limpiar el parámetro de la URL
      params.delete('google_connected');
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      checkStatus();
    }
  }, [checkStatus]);

  const connect = useCallback((returnUrl?: string) => {
    void startGoogleConnection(returnUrl).catch((error) => {
      console.error('Error iniciando Google OAuth:', error);
    });
  }, []);

  const disconnect = useCallback(async () => {
    try {
      const { error } = await api.delete('/api/auth/google/disconnect');

      if (!error) {
        setState({
          isConnected: false,
          isLoading: false,
          googleEmail: null,
          displayName: null,
          avatarUrl: null,
          scopes: null,
        });
      }
    } catch {
      // Ignorar errores de desconexión
    }
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    refresh: checkStatus,
  };
}
