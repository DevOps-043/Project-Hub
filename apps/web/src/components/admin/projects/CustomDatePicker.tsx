'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { es } from 'date-fns/locale';

interface CustomDatePickerProps {
  label: string;
  value: string;
  onChange: (date: string) => void;
  icon?: React.ReactNode;
  isDark: boolean;
  colors: { textPrimary: string; textSecondary: string; primary: string };
}

export function CustomDatePicker({ label, value, onChange, icon, isDark, colors }: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value ? new Date(value) : new Date());

  // Reset calendar view when value changes
  useEffect(() => {
    if (value) setCurrentMonth(new Date(value));
  }, [value]);

  const toggleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleDateClick = (e: React.MouseEvent, date: Date) => {
    e.stopPropagation();
    onChange(format(date, 'yyyy-MM-dd'));
    setIsOpen(false);
  };

  // Calendar generation logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const weekDays = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

  return (
    <div className="relative">
      <button
        onClick={toggleOpen}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all duration-200 hover:bg-white/10 border border-transparent hover:border-white/10 w-full text-left"
        style={{
          color: value ? (isDark ? '#E5E7EB' : '#374151') : (isDark ? '#9CA3AF' : '#6B7280'),
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
        }}
      >
        {icon}
        <span className="font-medium whitespace-nowrap overflow-hidden text-ellipsis">
          {value ? format(new Date(value), 'dd MMM yyyy', { locale: es }) : label}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute top-full left-0 mt-2 p-4 rounded-xl shadow-2xl border z-50 w-[280px]"
            style={{
              backgroundColor: isDark ? '#1E2329' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <span className="font-semibold capitalize text-sm" style={{ color: colors.textPrimary }}>
                {format(currentMonth, 'MMMM yyyy', { locale: es })}
              </span>
              <div className="flex gap-1">
                <button onClick={prevMonth} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <button onClick={nextMonth} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              </div>
            </div>

            {/* Week days */}
            <div className="grid grid-cols-7 mb-2">
              {weekDays.map(d => (
                <div key={d} className="text-center text-xs font-medium opacity-50 py-1" style={{ color: colors.textSecondary }}>
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
                    onClick={(e) => handleDateClick(e, dayItem)}
                    className={`
                      h-8 w-8 rounded-lg flex items-center justify-center text-sm transition-colors relative
                      ${!isCurrentMonth ? 'opacity-30' : ''}
                      ${isSelected ? 'bg-blue-600 text-white font-bold shadow-lg' : 'hover:bg-white/10'}
                    `}
                    style={{
                      color: isSelected ? '#FFFFFF' : (isDark ? '#E5E7EB' : '#374151'),
                      backgroundColor: isSelected ? '#3B82F6' : undefined,
                      border: isTodayDate && !isSelected ? `1px solid ${colors.primary}` : 'none'
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
                onClick={(e) => { e.stopPropagation(); onChange(''); setIsOpen(false); }}
                className="hover:underline opacity-70 hover:opacity-100 transition-opacity"
                style={{ color: colors.textSecondary }}
              >
                Borrar
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onChange(format(new Date(), 'yyyy-MM-dd')); setIsOpen(false); }}
                className="font-medium hover:underline"
                style={{ color: '#3B82F6' }}
              >
                Hoy
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop for closing */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}
