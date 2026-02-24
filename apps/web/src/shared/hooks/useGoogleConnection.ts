'use client';

import { useState, useEffect, useCallback } from 'react';

interface GoogleConnectionState {
  isConnected: boolean;
  isLoading: boolean;
  googleEmail: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  scopes: string[] | null;
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
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/auth/google/status', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        setState(prev => ({ ...prev, isConnected: false, isLoading: false }));
        return;
      }

      const data = await res.json();
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
    const url = returnUrl || window.location.pathname;
    window.location.href = `/api/auth/google/connect?returnUrl=${encodeURIComponent(url)}`;
  }, []);

  const disconnect = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/auth/google/disconnect', {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.ok) {
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
