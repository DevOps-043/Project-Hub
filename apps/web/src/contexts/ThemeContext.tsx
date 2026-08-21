'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem('admin-theme') as Theme;
    if (saved && (saved === 'light' || saved === 'dark')) {
      setTheme(saved);
    }
  }, []);

  useEffect(() => {
    // Save to localStorage and update document class
    localStorage.setItem('admin-theme', theme);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

// SOFIA Design System Colors
export const themeColors = {
  dark: {
    // Backgrounds
    bgPrimary: '#0F1419',
    bgSecondary: '#1E2329',
    bgTertiary: '#0A0D12',
    bgCard: '#1E2329',
    // Text
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255, 255, 255, 0.7)',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    // Borders
    border: 'rgba(255, 255, 255, 0.1)',
    borderHover: 'rgba(255, 255, 255, 0.2)',
    // Accents
    accent: '#00D4B3',
    accentHover: '#00B89C',
    primary: '#0A2540',
  },
  light: {
    // Backgrounds
    bgPrimary: '#FFFFFF',
    bgSecondary: '#F8FAFC',
    bgTertiary: '#F1F5F9',
    bgCard: '#FFFFFF',
    // Text
    textPrimary: '#0A2540',
    textSecondary: '#6C757D',
    textMuted: '#9CA3AF',
    // Borders
    border: '#E9ECEF',
    borderHover: '#D1D5DB',
    // Accents
    accent: '#00D4B3',
    accentHover: '#00B89C',
    primary: '#0A2540',
  },
};
