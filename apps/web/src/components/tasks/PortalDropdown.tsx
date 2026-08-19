'use client';

import { useState, useEffect, Children } from 'react';
import React from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import type { ModalColors } from './create-issue-types';

interface PortalDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  children: React.ReactNode;
  isDark: boolean;
  colors: ModalColors;
  width?: number;
}

export function PortalDropdown({ isOpen, onClose, triggerRef, children, isDark, colors, width = 200 }: PortalDropdownProps) {
  const [position, setPosition] = useState({ top: 0, left: 0, placement: 'bottom' as 'top' | 'bottom' });

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const updatePosition = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const dropdownHeight = 260; // Slightly more for safety
        const spaceBelow = window.innerHeight - rect.bottom;
        const shouldShowAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

        // Prevent horizontal overflow
        let left = rect.left;
        if (left + width > window.innerWidth) {
          left = window.innerWidth - width - 12; // 12px margin
        }
        if (left < 12) left = 12;

        setPosition({
          top: shouldShowAbove ? rect.top - 8 : rect.bottom + 4,
          left,
          placement: shouldShowAbove ? 'top' : 'bottom'
        });
      };

      updatePosition();
      // Use capture for scroll to catch it from any parent
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen, triggerRef, width]);

  if (!isOpen) return null;

  const hasChildren = Children.count(children) > 0;

  return createPortal(
    <>
      <div className="fixed inset-0" style={{ zIndex: 100000 }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: position.placement === 'bottom' ? -10 : 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed py-1 rounded-xl border shadow-2xl overflow-y-auto max-h-[300px]"
        style={{
          zIndex: 100001,
          top: position.placement === 'top' ? undefined : position.top,
          bottom: position.placement === 'top' ? (window.innerHeight - position.top) : undefined,
          left: position.left,
          width: width,
          maxHeight: '220px',
          backgroundColor: isDark ? '#1E2329' : '#ffffff',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)'
        }}
      >
        {hasChildren ? children : (
          <div className="px-4 py-6 text-xs text-center flex flex-col items-center gap-2" style={{ color: colors.textMuted }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-20">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            No hay opciones disponibles
          </div>
        )}
      </motion.div>
    </>,
    document.body
  );
}
