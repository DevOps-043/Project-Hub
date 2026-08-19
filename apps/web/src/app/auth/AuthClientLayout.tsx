'use client';

import React from 'react';
import { ThemeToggle } from '@/components/auth/ThemeToggle';
import { useTheme } from '@/contexts/ThemeContext';

export default function AuthClientLayout({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme();

  return (
    <main
      className="relative min-h-screen w-full transition-colors duration-300"
      style={{ backgroundColor: isDark ? '#0F1419' : '#F8FAFC' }}
    >
      <div className="fixed top-6 right-6 z-[60]">
        <ThemeToggle />
      </div>
      {children}
    </main>
  );
}
