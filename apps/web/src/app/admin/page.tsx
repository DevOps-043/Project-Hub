'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTheme, themeColors } from '@/contexts/ThemeContext';

export default function AdminDashboardPage() {
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;
  const router = useRouter();

  // Handler para acciones rápidas
  const handleQuickAction = (actionLabel: string) => {
    switch (actionLabel) {
      case 'Crear Usuario':
        router.push('/admin/users?create=true');
        break;
      case 'Nuevo Proyecto':
        router.push('/admin/projects?create=true');
        break;
      case 'Ver Reportes':
        router.push('/admin/reports');
        break;
      default:
        break;
    }
  };

  // Obtener saludo según la hora
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  // Obtener fecha formateada
  const getFormattedDate = () => {
    return new Date().toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Welcome Banner */}
      <div 
        className="relative overflow-hidden rounded-2xl p-6 md:p-8 transition-colors duration-300"
        style={{
          background: isDark 
            ? 'linear-gradient(135deg, rgba(0, 212, 179, 0.1) 0%, rgba(10, 37, 64, 0.8) 50%, rgba(15, 20, 25, 0.9) 100%)'
            : 'linear-gradient(135deg, rgba(0, 212, 179, 0.15) 0%, rgba(248, 250, 252, 0.9) 50%, rgba(255, 255, 255, 1) 100%)',
          border: `1px solid ${isDark ? 'rgba(0, 212, 179, 0.2)' : colors.border}`,
        }}
      >
        {/* Background Decorations */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#00D4B3]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#0A2540]/30 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00D4B3]/10 border border-[#00D4B3]/20 mb-4">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#00D4B3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="#00D4B3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="#00D4B3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-[#00D4B3] text-sm font-medium">PANEL DE CONTROL</span>
          </div>

          {/* Greeting */}
          <h1 
            className="text-2xl md:text-3xl font-bold mb-2 transition-colors"
            style={{ color: colors.textPrimary }}
          >
            {getGreeting()}, <span className="text-[#00D4B3]">Fernando Suarez</span>
          </h1>
          
          <p style={{ color: colors.textSecondary }} className="mb-4 max-w-xl">
            Gestiona tu plataforma de trabajo con IA. Tienes el control total.
          </p>

          {/* Date and Status */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2" style={{ color: colors.textSecondary }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span className="capitalize">{getFormattedDate()}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-green-500">Sistema Operativo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid - Placeholder for future content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {[1, 2, 3].map((i) => (
              <div 
                key={i}
                className="p-5 rounded-xl transition-all hover:border-[#00D4B3]/30"
                style={{ 
                  background: isDark ? 'rgba(30, 35, 41, 0.5)' : colors.bgCard,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div className="h-24 flex items-center justify-center">
                  <span style={{ color: colors.textMuted }} className="text-sm">Estadísticas {i}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Activity Section Placeholder */}
          <div 
            className="p-6 rounded-xl"
            style={{ 
              background: isDark ? 'rgba(30, 35, 41, 0.5)' : colors.bgCard,
              border: `1px solid ${colors.border}`,
            }}
          >
            <h3 style={{ color: colors.textPrimary }} className="font-semibold mb-4">Actividad Reciente</h3>
            <div className="h-48 flex items-center justify-center">
              <span style={{ color: colors.textMuted }} className="text-sm">Próximamente...</span>
            </div>
          </div>
        </div>

        {/* Quick Actions Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div 
            className="p-5 rounded-xl"
            style={{ 
              background: isDark ? 'rgba(30, 35, 41, 0.5)' : colors.bgCard,
              border: `1px solid ${colors.border}`,
            }}
          >
            <h3 style={{ color: colors.textPrimary }} className="font-semibold mb-4">Acciones Rápidas</h3>
            <div className="space-y-3">
              {[
                { label: 'Crear Usuario', desc: 'Añadir nuevo miembro' },
                { label: 'Nuevo Proyecto', desc: 'Iniciar proyecto' },
                { label: 'Ver Reportes', desc: 'Análisis y métricas' },
              ].map((action, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickAction(action.label)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-transparent hover:border-[#00D4B3]/30 transition-all group"
                  style={{ 
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDark ? 'rgba(0, 212, 179, 0.1)' : 'rgba(0, 212, 179, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)';
                  }}
                >
                  <div className="w-10 h-10 rounded-lg bg-[#00D4B3]/10 flex items-center justify-center group-hover:bg-[#00D4B3]/20 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00D4B3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </div>
                  <div className="text-left">
                    <span style={{ color: colors.textPrimary }} className="text-sm font-medium block">{action.label}</span>
                    <span style={{ color: colors.textMuted }} className="text-xs">{action.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
