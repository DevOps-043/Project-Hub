'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';

interface ARIAContextType {
  isOpen: boolean;
  openARIA: () => void;
  closeARIA: () => void;
  toggleARIA: () => void;
}

const ARIAContext = createContext<ARIAContextType | undefined>(undefined);

export function ARIAProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openARIA = useCallback(() => setIsOpen(true), []);
  const closeARIA = useCallback(() => setIsOpen(false), []);
  const toggleARIA = useCallback(() => setIsOpen((current) => !current), []);

  return (
    <ARIAContext.Provider value={{ isOpen, openARIA, closeARIA, toggleARIA }}>
      {children}
    </ARIAContext.Provider>
  );
}

export function useARIA() {
  const context = useContext(ARIAContext);
  if (!context) {
    throw new Error('useARIA must be used within ARIAProvider');
  }

  return context;
}

export const ARIA_PANEL_WIDTH = 420;
