'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarRange, Check, ChevronDown, Kanban, LayoutList, RotateCcw, X } from 'lucide-react';
import styles from './DisplaySettings.module.css';

export type ViewType = 'list' | 'board' | 'timeline';
type Grouping = 'none' | 'status' | 'priority';
type Ordering = 'manual' | 'alphabetical' | 'newest';
type Visibility = 'all' | 'active' | 'closed';

interface DisplaySettingsProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  grouping: Grouping;
  onGroupingChange: (grouping: Grouping) => void;
  ordering: Ordering;
  onOrderingChange: (ordering: Ordering) => void;
  showClosed: Visibility;
  onShowClosedChange: (value: Visibility) => void;
  showCycles: boolean;
  onShowCyclesChange: (value: boolean) => void;
}

const views = [
  { value: 'list' as const, label: 'Lista', icon: LayoutList },
  { value: 'board' as const, label: 'Tablero', icon: Kanban },
  { value: 'timeline' as const, label: 'Cronología', icon: CalendarRange },
];

function SettingSelect<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <span className={styles.selectWrap}>
        <select value={value} onChange={(event) => onChange(event.target.value as T)}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <ChevronDown size={14} aria-hidden />
      </span>
    </label>
  );
}

export function DisplaySettings({
  isOpen, onClose, currentView, onViewChange, triggerRef, grouping, onGroupingChange,
  ordering, onOrderingChange, showClosed, onShowClosedChange, showCycles, onShowCyclesChange,
}: DisplaySettingsProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const closeFromOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) onClose();
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeFromOutside);
    document.addEventListener('keydown', closeFromKeyboard);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside);
      document.removeEventListener('keydown', closeFromKeyboard);
    };
  }, [isOpen, onClose, triggerRef]);

  const reset = () => {
    onViewChange('list');
    onGroupingChange('none');
    onOrderingChange('manual');
    onShowClosedChange('all');
    onShowCyclesChange(true);
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-label="Configurar visualización de proyectos"
          className={styles.panel}
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.16 }}
        >
          <header className={styles.header}>
            <div><span className={styles.eyebrow}>Vista</span><strong>Preferencias de visualización</strong></div>
            <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Cerrar preferencias"><X size={16} aria-hidden /></button>
          </header>

          <div className={styles.views} role="group" aria-label="Tipo de vista">
            {views.map(({ value, label, icon: Icon }) => (
              <button key={value} type="button" data-active={currentView === value} onClick={() => onViewChange(value)}>
                <Icon size={18} strokeWidth={1.7} aria-hidden />
                <span>{label}</span>
                {currentView === value ? <Check size={13} aria-hidden /> : null}
              </button>
            ))}
          </div>

          <div className={styles.fields}>
            <SettingSelect label="Agrupar" value={grouping} onChange={onGroupingChange} options={[
              { value: 'none', label: 'Sin agrupación' }, { value: 'status', label: 'Por estado' }, { value: 'priority', label: 'Por prioridad' },
            ]} />
            <SettingSelect label="Ordenar" value={ordering} onChange={onOrderingChange} options={[
              { value: 'manual', label: 'Manual' }, { value: 'alphabetical', label: 'Alfabético' }, { value: 'newest', label: 'Más recientes' },
            ]} />
            <SettingSelect label="Proyectos" value={showClosed} onChange={onShowClosedChange} options={[
              { value: 'all', label: 'Todos' }, { value: 'active', label: 'Solo activos' }, { value: 'closed', label: 'Solo cerrados' },
            ]} />
            <label className={styles.toggleRow}>
              <span><strong>Mostrar ciclos</strong><small>Incluye el ciclo actual en cada proyecto.</small></span>
              <input type="checkbox" checked={showCycles} onChange={(event) => onShowCyclesChange(event.target.checked)} />
              <i aria-hidden />
            </label>
          </div>

          <footer className={styles.footer}>
            <button type="button" className={styles.reset} onClick={reset}><RotateCcw size={14} aria-hidden /> Restablecer</button>
            <button type="button" className={styles.done} onClick={onClose}>Aplicar</button>
          </footer>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
