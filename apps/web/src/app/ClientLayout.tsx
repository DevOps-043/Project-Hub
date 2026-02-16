'use client';

import { useEffect } from 'react';
import FocusEnforcer from '@/features/tools/FocusEnforcer';
import { useAuthStore } from '@/core/stores/authStore';
import { ThemeProvider } from '@/contexts/ThemeContext';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { initialize, isInitialized } = useAuthStore();

  // Inicializar autenticación al cargar
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  return (
    <ThemeProvider>
      <FocusEnforcer />
      {children}
    </ThemeProvider>
  );
}
