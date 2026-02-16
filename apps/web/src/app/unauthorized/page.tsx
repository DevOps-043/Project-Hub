'use client';

import React from 'react';
import Link from 'next/link';
import { useTheme, themeColors } from '@/contexts/ThemeContext';

export default function UnauthorizedPage() {
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: isDark ? '#0F1419' : '#F3F4F6' }}
    >
      <div
        className="max-w-md w-full text-center p-10 rounded-2xl border shadow-lg"
        style={{
          backgroundColor: isDark ? '#161b22' : '#fff',
          borderColor: colors.border,
        }}
      >
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#EF4444"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1
          className="text-3xl font-bold mb-3"
          style={{ color: colors.textPrimary }}
        >
          Acceso Denegado
        </h1>

        <p className="text-base mb-8" style={{ color: colors.textMuted }}>
          No tienes permisos para acceder a esta seccion. Contacta a un
          administrador si crees que esto es un error.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="px-6 py-3 rounded-xl font-semibold text-black transition-all hover:opacity-90"
            style={{ backgroundColor: '#00D4B3' }}
          >
            Ir al Inicio
          </Link>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-3 rounded-xl font-medium transition-colors"
            style={{
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.05)'
                : 'rgba(0,0,0,0.05)',
              color: colors.textSecondary,
            }}
          >
            Volver
          </button>
        </div>
      </div>
    </div>
  );
}
