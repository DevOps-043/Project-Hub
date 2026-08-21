'use client';

import { useTheme, themeColors } from '@/contexts/ThemeContext';

interface TeamPanelEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void } | null;
}

/**
 * Estado vacío único para los paneles de equipo (SOFIA_DESIGN_SYSTEM.md §30.1:
 * icono + título + frase + una acción). Reemplaza los bloques hechos a mano
 * que Tareas/Proyectos/Ciclos duplicaban cada uno con su propio tamaño de
 * icono y color de CTA, y cubre Miembros, que no tenía ninguno.
 */
export function TeamPanelEmptyState({ icon, title, description, action }: TeamPanelEmptyStateProps) {
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;

  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 9%, transparent)', color: 'var(--color-accent)' }}
      >
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2" style={{ color: colors.textPrimary, fontFamily: 'var(--font-system-display)' }}>
        {title}
      </h3>
      <p className="text-sm max-w-sm mb-6" style={{ color: colors.textMuted }}>
        {description}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-transform hover:-translate-y-px"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
