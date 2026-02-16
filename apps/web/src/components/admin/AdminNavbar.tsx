'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { NotificationCenter } from '@/features/notifications/NotificationCenter';

// Iconos
const icons = {
  bell: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  search: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  menu: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
  arrowRight: (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
  folder: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>),
  task: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>),
  user: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>),
  users: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>)
};

// Acciones rápidas
const quickActions = [
  { label: 'Usuarios', shortcut: 'U', action: '/admin/users' },
  { label: 'Proyectos', shortcut: 'P', action: '/admin/projects' },
  { label: 'Analytics', shortcut: 'A', action: '/admin/reports' },
  { label: 'Configuración', shortcut: 'C', action: '/admin/settings' },
];

interface AdminNavbarProps {
  sidebarCollapsed: boolean;
  onMenuClick: () => void;
  isMobile?: boolean;
  workspaceLogo?: string | null;
  workspaceName?: string;
}

export const AdminNavbar: React.FC<AdminNavbarProps> = ({
  sidebarCollapsed,
  onMenuClick,
  isMobile,
  workspaceLogo,
  workspaceName,
}) => {
  const router = useRouter();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;

  // Search Logic with Debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchValue.length >= 2) {
        setIsSearching(true);
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(searchValue)}`);
            if (res.ok) {
                const data = await res.json();
                setSearchResults(data);
            }
        } catch(e) {
            console.error(e);
        } finally {
            setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchValue]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setIsSearchFocused(true);
        inputRef.current?.focus();
      }
      if (event.key === 'Escape') {
        setIsSearchFocused(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleResultClick = (url: string) => {
      router.push(url);
      setIsSearchFocused(false);
      setSearchValue('');
  };

  const getResultIcon = (type: string) => {
      switch(type) {
          case 'project': return icons.folder;
          case 'task': return icons.task;
          case 'user': return icons.user;
          case 'team': return icons.users; // Team icon
          default: return icons.search;
      }
  };

  return (
    <header
      className="fixed top-0 h-16 z-30 flex items-center justify-between px-6 transition-all duration-300 ease-in-out"
      style={{
        left: isMobile ? '0px' : (sidebarCollapsed ? '72px' : '260px'),
        right: '0px',
        background: isDark ? 'rgba(15, 20, 25, 0.8)' : 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      {/* Left Section */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className={`p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors ${isMobile ? '' : 'hidden'}`}
        >
          {icons.menu}
        </button>

        {/* Workspace Logo & Name */}
        {workspaceLogo && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border" style={{ borderColor: colors.border }}>
              <img
                src={workspaceLogo}
                alt={workspaceName || 'Workspace'}
                className="w-full h-full object-contain"
              />
            </div>
            {workspaceName && (
              <span className="text-sm font-semibold hidden sm:block truncate max-w-[200px]" style={{ color: colors.textPrimary }}>
                {workspaceName}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3">
        {/* Search Bar Container */}
        <div ref={searchContainerRef} className="relative">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200"
            style={{
              width: isSearchFocused ? '420px' : '250px',
              backgroundColor: isSearchFocused 
                ? (isDark ? '#1a1f25' : colors.bgCard) 
                : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
              borderColor: isSearchFocused 
                ? 'rgba(0,212,179,0.4)' 
                : colors.border,
              cursor: isSearchFocused ? 'text' : 'pointer',
            }}
            onClick={() => {
              setIsSearchFocused(true);
              inputRef.current?.focus();
            }}
          >
            <span style={{ color: isSearchFocused ? '#00D4B3' : colors.textMuted }}>
                {isSearching ? (
                   <div className="w-4 h-4 border-2 border-t-transparent border-[#00D4B3] rounded-full animate-spin"></div>
                ) : icons.search}
            </span>
            
            <input
              ref={inputRef}
              type="text"
              placeholder={isSearchFocused ? "Buscar tareas, proyectos, usuarios..." : "Buscar..."}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              className="bg-transparent text-sm focus:outline-none placeholder-opacity-50 w-full"
              style={{
                color: colors.textPrimary,
              }}
            />
            
            {!isSearchFocused && (
              <kbd 
                className="text-[10px] px-1.5 py-0.5 rounded font-mono hidden sm:inline-block whitespace-nowrap ml-2"
                style={{ 
                  backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                  color: colors.textMuted 
                }}
              >⌘K</kbd>
            )}
          </div>

          {/* Search Results / Quick Actions Dropdown */}
          {isSearchFocused && (
            <div 
              className="absolute top-full right-0 mt-2 w-[380px] py-2 rounded-xl border shadow-xl max-h-[80vh] overflow-y-auto"
              style={{ 
                background: isDark ? '#1a1f25' : colors.bgCard,
                borderColor: colors.border,
              }}
            >
              {searchValue.length >= 2 ? (
                // --- SEARCH RESULTS ---
                <>
                    {searchResults.length > 0 ? (
                        <div className="py-1">
                             <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: colors.textMuted }}>Resultados</p>
                             {searchResults.map((result) => (
                                <button
                                    key={`${result.type}-${result.id}`}
                                    onClick={() => handleResultClick(result.url)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
                                >
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-500/10 text-gray-500">
                                        {result.avatar ? (
                                            <img src={result.avatar} alt="" className="w-full h-full rounded-lg object-cover" />
                                        ) : getResultIcon(result.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate" style={{ color: colors.textPrimary }}>{result.title}</p>
                                        <p className="text-xs truncate" style={{ color: colors.textSecondary }}>{result.subtitle}</p>
                                    </div>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-500 uppercase">{result.type}</span>
                                </button>
                             ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center" style={{ color: colors.textMuted }}>
                            {isSearching ? <p>Buscando...</p> : <p>No se encontraron resultados para "{searchValue}"</p>}
                        </div>
                    )}
                </>
              ) : (
                // --- QUICK ACTIONS ---
                <>
                  <div className="px-3 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: colors.textMuted }}>
                      Acciones rápidas
                    </p>
                    <div className="space-y-0.5">
                      {quickActions.map((action, i) => (
                        <button
                          key={i}
                          onClick={() => handleResultClick(action.action)}
                          className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                          style={{ color: colors.textSecondary }}
                        >
                          <span>{action.label}</span>
                          <div className="flex items-center gap-1.5" style={{ color: colors.textMuted }}>
                            <kbd 
                              className="text-[10px] px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}
                            >{action.shortcut}</kbd>
                            {icons.arrowRight}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tip */}
                  <div className="px-3 py-2 mt-1" style={{ borderTop: `1px solid ${colors.border}` }}>
                    <p className="text-[11px]" style={{ color: colors.textMuted }}>
                      Presiona <kbd 
                        className="mx-1 text-[10px] px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}
                      >Esc</kbd> para cerrar
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Notifications */}
        <NotificationCenter />
      </div>
    </header>
  );
};

export default AdminNavbar;
