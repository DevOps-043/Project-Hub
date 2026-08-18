/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // SOFIA Design System - Core Colors
        sofia: {
          primary: '#0A2540',      // Azul Profundo
          accent: '#00D4B3',       // Aqua/Verde Azulado
          white: '#FFFFFF',        // Blanco
        },
        // Secondary Colors
        success: '#10B981',        // Verde Suave
        warning: '#F59E0B',        // Ámbar
        error: '#EF4444',          // Rojo
        // Grays
        gray: {
          50: '#F9FAFB',
          100: '#F7F9FB',
          200: '#E9ECEF',
          300: '#DEE2E6',
          400: '#6C757D',
          500: '#495057',
          600: '#343A40',
          700: '#2D3748',
          800: '#1E2329',
          900: '#0A1633',
        },
        // Dark Mode
        dark: {
          bg: '#0F1419',
          card: '#1E2329',
          tertiary: '#0A0D12',
        },
      },
      fontFamily: {
        sans: ['var(--font-system-ui)', 'Arial', 'sans-serif'],
        display: ['var(--font-system-display)', 'Georgia', 'serif'],
        label: ['var(--font-system-label)', 'Arial', 'sans-serif'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1.4' }],      // 12px
        'sm': ['0.875rem', { lineHeight: '1.4' }],    // 14px
        'base': ['1rem', { lineHeight: '1.5' }],      // 16px
        'lg': ['1.125rem', { lineHeight: '1.5' }],    // 18px
        'xl': ['1.25rem', { lineHeight: '1.4' }],     // 20px
        '2xl': ['1.75rem', { lineHeight: '1.3' }],    // 28px
        '3xl': ['2rem', { lineHeight: '1.2' }],       // 32px
        '4xl': ['2.5rem', { lineHeight: '1.2' }],     // 40px
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      borderRadius: {
        'xl': '0.75rem',    // 12px
        '2xl': '1rem',      // 16px
        '3xl': '1.5rem',    // 24px
      },
      boxShadow: {
        'sm': '0 1px 2px rgba(10, 37, 64, 0.05)',
        'DEFAULT': '0 2px 8px rgba(10, 37, 64, 0.08)',
        'md': '0 4px 16px rgba(10, 37, 64, 0.1)',
        'lg': '0 8px 24px rgba(10, 37, 64, 0.12)',
        'xl': '0 16px 48px rgba(10, 37, 64, 0.16)',
        '2xl': '0 25px 50px -12px rgba(10, 37, 64, 0.25)',
      },
      animation: {
        'fadeIn': 'fadeIn 0.5s ease-out forwards',
        'slideUp': 'slideUp 0.5s ease-out forwards',
        'slideDown': 'slideDown 0.5s ease-out forwards',
        'scaleIn': 'scaleIn 0.3s ease-out forwards',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      transitionDuration: {
        '400': '400ms',
      },
      backdropBlur: {
        'xs': '2px',
      },
    },
  },
  plugins: [],
}
