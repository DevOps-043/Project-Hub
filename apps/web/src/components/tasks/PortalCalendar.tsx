'use client';

import { useState, useEffect } from 'react';
import React from 'react';
import { motion } from 'framer-motion';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { createPortal } from 'react-dom';
import type { ModalColors } from './create-issue-types';

interface PortalCalendarProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  value: string;
  onChange: (date: string) => void;
  isDark: boolean;
  colors: ModalColors;
  accentColor: string;
}

export function PortalCalendar({ isOpen, onClose, triggerRef, value, onChange, isDark, colors, accentColor }: PortalCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(value ? new Date(value) : new Date());
  const [position, setPosition] = useState({ top: 0, left: 0, placement: 'bottom' as 'top' | 'bottom' });

  useEffect(() => {
    if (value) setCurrentMonth(new Date(value));
  }, [value]);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const updatePosition = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const calendarHeight = 340;
        const spaceBelow = window.innerHeight - rect.bottom;
        const shouldShowAbove = spaceBelow < calendarHeight && rect.top > calendarHeight;

        setPosition({
          top: shouldShowAbove ? rect.top - 8 : rect.bottom + 4,
          left: rect.left,
          placement: shouldShowAbove ? 'top' : 'bottom'
        });
      };

      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen, triggerRef]);

  const handleDateClick = (date: Date) => {
    onChange(format(date, 'yyyy-MM-dd'));
    onClose();
  };

  // Calendar generation
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="fixed inset-0" style={{ zIndex: 100000 }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: position.placement === 'bottom' ? -10 : 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed p-4 rounded-xl border shadow-2xl"
        data-sofia-popover
        role="dialog"
        aria-label="Seleccionar fecha límite"
        style={{
          zIndex: 100001,
          top: position.placement === 'top' ? undefined : position.top,
          bottom: position.placement === 'top' ? (window.innerHeight - position.top) : undefined,
          left: position.left,
          width: 280,
          backgroundColor: isDark ? '#1E2329' : '#ffffff',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <span className="font-semibold capitalize text-sm" style={{ color: colors.textPrimary }}>
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              type="button"
              aria-label="Mes anterior"
              className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
              style={{ color: colors.textMuted }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              type="button"
              aria-label="Mes siguiente"
              className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
              style={{ color: colors.textMuted }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Week days */}
        <div className="grid grid-cols-7 mb-2">
          {weekDays.map(d => (
            <div key={d} className="text-center text-xs font-medium py-1" style={{ color: colors.textMuted }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((dayItem, i) => {
            const isSelected = value ? isSameDay(dayItem, new Date(value)) : false;
            const isCurrentMonth = isSameMonth(dayItem, monthStart);
            const isTodayDate = isToday(dayItem);

            return (
              <button
                key={i}
                type="button"
                onClick={() => handleDateClick(dayItem)}
                className={`
                  h-8 w-8 rounded-lg flex items-center justify-center text-sm transition-all relative
                  ${!isCurrentMonth ? 'opacity-30' : ''}
                  ${isSelected ? 'font-bold shadow-lg' : 'hover:bg-white/10'}
                `}
                style={{
                  color: isSelected ? '#FFFFFF' : colors.textPrimary,
                  backgroundColor: isSelected ? accentColor : undefined,
                  border: isTodayDate && !isSelected ? `1px solid ${accentColor}` : 'none'
                }}
              >
                {format(dayItem, 'd')}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t flex justify-between text-xs" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
          <button
            type="button"
            onClick={() => { onChange(''); onClose(); }}
            className="hover:underline opacity-70 hover:opacity-100 transition-opacity"
            style={{ color: colors.textSecondary }}
          >
            Borrar
          </button>
          <button
            type="button"
            onClick={() => { onChange(format(new Date(), 'yyyy-MM-dd')); onClose(); }}
            className="font-medium hover:underline"
            style={{ color: accentColor }}
          >
            Hoy
          </button>
        </div>
      </motion.div>
    </>,
    document.body
  );
}
