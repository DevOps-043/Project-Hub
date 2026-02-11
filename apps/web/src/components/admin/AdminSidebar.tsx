'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/core/stores/authStore';

// Iconos simulados con SVG inline
const icons = {
  dashboard: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  users: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  projects: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  teams: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  tools: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  ),
  analytics: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  settings: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  reports: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  chevronLeft: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  chevronRight: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
};

interface MenuItem {
  id: string;
  label: string;
  icon: keyof typeof icons;
  href: string;
  badge?: number;
}

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', href: '/admin' },
  { id: 'users', label: 'Usuarios', icon: 'users', href: '/admin/users' },
  { id: 'teams', label: 'Equipos', icon: 'teams', href: '/admin/teams' },
  { id: 'projects', label: 'Proyectos', icon: 'projects', href: '/admin/projects' },
  { id: 'tools', label: 'Herramientas', icon: 'tools', href: '/admin/tools' },
  { id: 'analytics', label: 'Analytics', icon: 'analytics', href: '/admin/analytics' },
  { id: 'reports', label: 'Reportes', icon: 'reports', href: '/admin/reports' },
  { id: 'settings', label: 'Configuración', icon: 'settings', href: '/admin/settings' },
];

// Teams Dropdown Component - Similar to Linear
interface Team {
  id: string;
  name: string;
  color: string;
  memberCount: number;
}

// Subopciones de cada equipo (como en Linear)
const TEAM_SUBOPTIONS = [
  { 
    id: 'issues', 
    label: 'Tareas', 
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6l4 2"/>
      </svg>
    ),
    href: (teamId: string) => `/admin/teams/${teamId}/tasks`
  },
  { 
    id: 'cycles', 
    label: 'Cycles', 
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    href: (teamId: string) => `/admin/teams/${teamId}/cycles`
  },
  { 
    id: 'projects', 
    label: 'Proyectos', 
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    href: (teamId: string) => `/admin/teams/${teamId}/projects`
  },
  { 
    id: 'members', 
    label: 'Miembros', 
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    href: (teamId: string) => `/admin/teams/${teamId}/members`
  },
  { 
    id: 'settings', 
    label: 'Configuración', 
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
    href: (teamId: string) => `/admin/teams/${teamId}/settings`
  },
];

function TeamsDropdown() {
  const [isOpen, setIsOpen] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;
  const pathname = usePathname();

  React.useEffect(() => {
    const fetchTeams = async () => {
      try {
        const res = await fetch('/api/admin/teams?limit=50');
        const data = await res.json();
        if (res.ok && data.teams) {
          setTeams(data.teams);
        }
      } catch (e) {
        console.error('Error fetching teams:', e);
      }
      setLoading(false);
    };
    fetchTeams();
  }, []);

  const toggleTeamExpand = (teamId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedTeam(expandedTeam === teamId ? null : teamId);
  };

  return (
    <div className="px-3 mt-4">
      {/* Section Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wider rounded-lg transition-colors"
        style={{ color: colors.textMuted }}
      >
        <span>Tus Equipos</span>
        <svg 
          width="12" 
          height="12" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          className={`transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Teams List */}
      {isOpen && (
        <div className="mt-1 space-y-0.5">
          {loading ? (
            <div className="flex justify-center py-3">
              <div className="w-4 h-4 border-2 border-[#00D4B3] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : teams.length === 0 ? (
            <p className="text-xs px-3 py-2" style={{ color: colors.textMuted }}>
              Sin equipos
            </p>
          ) : (
            teams.map((team) => {
              const isExpanded = expandedTeam === team.id;
              const isTeamActive = pathname.startsWith(`/admin/teams/${team.id}`);
              
              return (
                <div key={team.id}>
                  {/* Team Row */}
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all group cursor-pointer"
                    style={{
                      background: isExpanded || isTeamActive
                        ? (isDark ? 'rgba(0,212,179,0.1)' : 'rgba(0,212,179,0.05)')
                        : 'transparent',
                    }}
                    onClick={(e) => toggleTeamExpand(team.id, e)}
                  >
                    {/* Expand Arrow */}
                    <svg 
                      width="12" 
                      height="12" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                      className={`transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
                      style={{ color: colors.textMuted }}
                    >
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>

                    {/* Team Color Badge */}
                    <div 
                      className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white"
                      style={{ backgroundColor: team.color }}
                    >
                      {team.name.substring(0, 1).toUpperCase()}
                    </div>

                    {/* Team Name */}
                    <span 
                      className="text-sm font-medium flex-1 truncate group-hover:text-[#00D4B3] transition-colors"
                      style={{ color: isExpanded || isTeamActive ? '#00D4B3' : colors.textSecondary }}
                    >
                      {team.name}
                    </span>

                    {/* More Options Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Aquí podrías abrir un menú contextual
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 transition-all"
                      style={{ color: colors.textMuted }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="2"/>
                        <circle cx="12" cy="12" r="2"/>
                        <circle cx="12" cy="19" r="2"/>
                      </svg>
                    </button>
                  </div>

                  {/* Suboptions (when expanded) */}
                  {isExpanded && (
                    <div className="ml-4 mt-1 space-y-0.5 border-l-2 pl-2" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                      {TEAM_SUBOPTIONS.map((option) => {
                        const optionPath = option.href(team.id);
                        const isOptionActive = pathname === optionPath;
                        
                        return (
                          <Link
                            key={option.id}
                            href={optionPath}
                            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-all group"
                            style={{
                              background: isOptionActive
                                ? (isDark ? 'rgba(0,212,179,0.15)' : 'rgba(0,212,179,0.1)')
                                : 'transparent',
                              color: isOptionActive ? '#00D4B3' : colors.textMuted,
                            }}
                          >
                            <span className="flex-shrink-0 opacity-70 group-hover:opacity-100">
                              {option.icon}
                            </span>
                            <span className="text-sm group-hover:text-[#00D4B3] transition-colors">
                              {option.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Add Team Button */}
          <Link
            href="/admin/teams"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all group mt-2"
            style={{ color: colors.textMuted }}
          >
            <div 
              className="w-5 h-5 rounded flex items-center justify-center"
              style={{ border: `1.5px dashed ${colors.textMuted}` }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </div>
            <span className="text-sm group-hover:text-[#00D4B3] transition-colors">
              Gestionar equipos
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}

interface AdminSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ isCollapsed, onToggle, isMobile, isMobileOpen, onMobileClose }) => {
  const pathname = usePathname();
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;

  // On mobile: sidebar is visible only when isMobileOpen is true
  // On desktop: sidebar is always visible, toggling between collapsed/expanded
  const sidebarVisible = isMobile ? isMobileOpen : true;
  const sidebarWidth = isMobile ? 'w-[260px]' : (isCollapsed ? 'w-[72px]' : 'w-[260px]');

  // Auto-close sidebar on navigation in mobile
  const handleNavClick = () => {
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobile && isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 h-screen z-50
          transition-all duration-300 ease-in-out
          ${sidebarWidth}
        `}
        style={{
          background: isDark 
            ? 'linear-gradient(180deg, #0A0D12 0%, #0F1419 100%)'
            : `linear-gradient(180deg, ${colors.bgPrimary} 0%, ${colors.bgSecondary} 100%)`,
          borderRight: `1px solid ${colors.border}`,
          transform: isMobile 
            ? (isMobileOpen ? 'translateX(0)' : 'translateX(-100%)')
            : 'translateX(0)',
        }}
      >
        {/* Logo Section */}
        <div className="h-16 flex items-center px-4" style={{ borderBottom: `1px solid ${colors.border}` }}>
          <Link href="/admin" className="flex items-center gap-3" onClick={handleNavClick}>
            {/* Logo Image */}
            <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center">
              <img 
                src="/Logo.png" 
                alt="IRIS Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            {(!isCollapsed || isMobile) && (
              <span style={{ color: colors.textPrimary }} className="font-semibold text-xl tracking-tight">IRIS</span>
            )}
          </Link>
          
          {/* Collapse/Close Button */}
          <button
            onClick={isMobile ? onMobileClose : onToggle}
            className={`
              ml-auto p-1.5 rounded-lg transition-all duration-200
              ${(!isMobile && isCollapsed) ? 'absolute right-2' : ''}
            `}
            style={{ color: colors.textSecondary }}
          >
            {isMobile ? icons.chevronLeft : (isCollapsed ? icons.chevronRight : icons.chevronLeft)}
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1 mt-2">
          {menuItems.map((item) => {
            // Dashboard (/admin) solo activo si la ruta es exactamente /admin
            const isActive = item.href === '/admin' 
              ? pathname === '/admin'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={handleNavClick}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative"
                style={{
                  background: isActive 
                    ? (isDark ? 'linear-gradient(to right, rgba(0,212,179,0.2), transparent)' : 'linear-gradient(to right, rgba(0,212,179,0.15), transparent)')
                    : 'transparent',
                  color: isActive ? colors.textPrimary : colors.textSecondary,
                }}
              >
                {/* Active indicator */}
                {isActive && (
                  <div 
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                    style={{ background: '#00D4B3' }}
                  />
                )}
                
                {/* Icon */}
                <span className={`${isActive ? 'text-[#00D4B3]' : 'group-hover:text-[#00D4B3]'} transition-colors`}>
                  {icons[item.icon]}
                </span>
                
                {/* Label */}
                {(!isCollapsed || isMobile) && (
                  <span className="font-medium text-sm" style={{ color: isActive ? colors.textPrimary : colors.textSecondary }}>
                    {item.label}
                  </span>
                )}
                
                {/* Badge */}
                {(!isCollapsed || isMobile) && item.badge && (
                  <span className="ml-auto bg-[#00D4B3] text-[#0A0D12] text-xs font-semibold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
                
                {/* Tooltip for collapsed state - only on desktop */}
                {!isMobile && isCollapsed && (
                  <div className="
                    absolute left-full ml-3 px-3 py-2 rounded-lg
                    bg-[#1E2329] text-white text-sm font-medium
                    opacity-0 invisible group-hover:opacity-100 group-hover:visible
                    transition-all duration-200 whitespace-nowrap z-50
                    shadow-lg
                  ">
                    {item.label}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-[#1E2329] rotate-45" />
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Teams Section - Similar to Linear */}
        {(!isCollapsed || isMobile) && <TeamsDropdown />}

        {/* Bottom Section - User Profile with Menu */}
        <UserProfileMenu isCollapsed={isMobile ? false : isCollapsed} />
      </aside>
    </>
  );
};

// User Profile Menu Component
function UserProfileMenu({ isCollapsed }: { isCollapsed: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/auth/sign-in';
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Obtener iniciales del usuario
  const getInitials = () => {
    if (!user?.name) return 'U';
    const parts = user.name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  // Obtener rol para mostrar
  const getRoleLabel = () => {
    if (user?.companyRole) return user.companyRole;
    switch (user?.role) {
      case 'admin': return 'Administrador';
      case 'user': return 'Usuario';
      default: return 'Invitado';
    }
  };

  return (
    <div className="absolute bottom-4 left-3 right-3">
      {/* User Menu Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div 
            className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border overflow-hidden shadow-xl z-40"
            style={{ 
              backgroundColor: isDark ? '#1E2329' : colors.bgCard, 
              borderColor: colors.border 
            }}
          >
            {/* Edit Profile */}
            <Link
              href="/admin/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-3 transition-colors"
              style={{ color: colors.textSecondary }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span className="text-sm">Editar perfil</span>
            </Link>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 transition-colors"
              style={{ color: colors.textSecondary }}
            >
              <div className="flex items-center gap-3">
                {isDark ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/>
                    <line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/>
                    <line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                )}
                <span className="text-sm">{isDark ? 'Modo oscuro' : 'Modo claro'}</span>
              </div>
              {/* Toggle Switch */}
              <div 
                className={`w-9 h-5 rounded-full transition-colors relative ${isDark ? 'bg-[#00D4B3]' : 'bg-gray-400'}`}
              >
                <div 
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${isDark ? 'left-[18px]' : 'left-0.5'}`}
                />
              </div>
            </button>

            {/* Divider */}
            <div className="border-t border-white/10 mx-3" />

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span className="text-sm">Cerrar sesión</span>
            </button>
          </div>
        </>
      )}

      {/* User Card */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`rounded-xl transition-all duration-200 cursor-pointer ${isCollapsed ? 'p-2' : 'p-3'}`}
        style={{
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          border: `1px solid ${colors.border}`,
        }}
      >
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          {/* Avatar */}
          <div className="relative">
            <div 
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-semibold text-sm overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #00D4B3 0%, #00A896 100%)' }}
            >
              {user?.avatar ? (
                <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                getInitials()
              )}
            </div>
            {/* Online indicator */}
            <div 
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2"
              style={{ borderColor: isDark ? '#0A0D12' : colors.bgPrimary }}
            />
          </div>

          {/* User Info - Only show when not collapsed */}
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: colors.textPrimary }}>
                  {user?.name || 'Usuario'}
                </p>
                <p className="text-xs truncate" style={{ color: colors.textMuted }}>
                  {getRoleLabel()}
                </p>
              </div>

              {/* Menu Icon */}
              <div 
                className="p-1.5 rounded-lg transition-colors"
                style={{ 
                  color: isOpen ? '#00D4B3' : colors.textSecondary,
                  backgroundColor: isOpen ? 'rgba(0,212,179,0.1)' : 'transparent'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="1"/>
                  <circle cx="12" cy="5" r="1"/>
                  <circle cx="12" cy="19" r="1"/>
                </svg>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminSidebar;

