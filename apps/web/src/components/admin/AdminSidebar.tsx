'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/core/stores/authStore';
import shellStyles from './AdminShell.module.css';
import {
  Blocks,
  BriefcaseBusiness,
  ChartSpline,
  ChevronRight,
  Clock3,
  ContactRound,
  FileChartColumn,
  FolderKanban,
  House,
  ListChecks,
  LogOut,
  Moon,
  MoreVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings2,
  SlidersHorizontal,
  Sun,
  UserRound,
  UsersRound,
} from 'lucide-react';

const icons = {
  dashboard: <House size={19} strokeWidth={1.8} />,
  users: <ContactRound size={19} strokeWidth={1.8} />,
  projects: <BriefcaseBusiness size={19} strokeWidth={1.8} />,
  teams: <UsersRound size={19} strokeWidth={1.8} />,
  tasks: <ListChecks size={19} strokeWidth={1.8} />,
  analytics: <ChartSpline size={19} strokeWidth={1.8} />,
  settings: <SlidersHorizontal size={19} strokeWidth={1.8} />,
  reports: <FileChartColumn size={19} strokeWidth={1.8} />,
  tools: <Blocks size={19} strokeWidth={1.8} />,
};

interface MenuItem {
  id: string;
  label: string;
  icon: keyof typeof icons;
  path: string; // relative path (e.g. '' for dashboard, '/users', '/teams')
  badge?: number;
}

// Menu items per role
const ownerMenuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', path: '' },
  { id: 'users', label: 'Usuarios', icon: 'users', path: '/members' },
  { id: 'teams', label: 'Equipos', icon: 'teams', path: '/teams' },
  { id: 'tasks', label: 'Tareas', icon: 'tasks', path: '/tasks' },
  { id: 'projects', label: 'Proyectos', icon: 'projects', path: '/projects' },

  { id: 'analytics', label: 'Analytics', icon: 'analytics', path: '/analytics' },
  { id: 'reports', label: 'Reportes', icon: 'reports', path: '/reports' },
  { id: 'tools', label: 'Herramientas', icon: 'tools', path: '/tools' },
  { id: 'settings', label: 'Configuración', icon: 'settings', path: '/settings' },
];

const adminMenuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', path: '' },
  { id: 'users', label: 'Usuarios', icon: 'users', path: '/members' },
  { id: 'teams', label: 'Equipos', icon: 'teams', path: '/teams' },
  { id: 'tasks', label: 'Tareas', icon: 'tasks', path: '/tasks' },
  { id: 'projects', label: 'Proyectos', icon: 'projects', path: '/projects' },

  { id: 'analytics', label: 'Analytics', icon: 'analytics', path: '/analytics' },
  { id: 'reports', label: 'Reportes', icon: 'reports', path: '/reports' },
  { id: 'tools', label: 'Herramientas', icon: 'tools', path: '/tools' },
];

const managerMenuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', path: '' },
  { id: 'teams', label: 'Equipos', icon: 'teams', path: '/teams' },
  { id: 'tasks', label: 'Tareas', icon: 'tasks', path: '/tasks' },
  { id: 'projects', label: 'Proyectos', icon: 'projects', path: '/projects' },
  { id: 'reports', label: 'Reportes', icon: 'reports', path: '/reports' },
  { id: 'tools', label: 'Herramientas', icon: 'tools', path: '/tools' },
];

const leaderMenuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', path: '' },
  { id: 'teams', label: 'Mis Equipos', icon: 'teams', path: '/teams' },
  { id: 'tasks', label: 'Tareas', icon: 'tasks', path: '/tasks' },
  { id: 'projects', label: 'Mis Proyectos', icon: 'projects', path: '/projects' },
  { id: 'reports', label: 'Reportes', icon: 'reports', path: '/reports' },
  { id: 'tools', label: 'Herramientas', icon: 'tools', path: '/tools' },
];

const memberMenuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', path: '' },
  { id: 'teams', label: 'Mis Equipos', icon: 'teams', path: '/teams' },
  { id: 'tasks', label: 'Tareas', icon: 'tasks', path: '/tasks' },
  { id: 'projects', label: 'Mis Proyectos', icon: 'projects', path: '/projects' },
  { id: 'reports', label: 'Reportes', icon: 'reports', path: '/reports' },
  { id: 'tools', label: 'Herramientas', icon: 'tools', path: '/tools' },
];

function getMenuForRole(role: string | undefined, isOrgContext: boolean): MenuItem[] {
  if (!isOrgContext) return ownerMenuItems;
  switch (role) {
    case 'owner': return ownerMenuItems;
    case 'admin': return adminMenuItems;
    case 'manager': return managerMenuItems;
    case 'leader': return leaderMenuItems;
    default: return memberMenuItems;
  }
}

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
    icon: <ListChecks size={16} strokeWidth={1.8} />,
    href: (basePath: string, teamId: string) => `${basePath}/teams/${teamId}/tasks`
  },
  {
    id: 'cycles',
    label: 'Cycles',
    icon: <Clock3 size={16} strokeWidth={1.8} />,
    href: (basePath: string, teamId: string) => `${basePath}/teams/${teamId}/cycles`
  },
  {
    id: 'projects',
    label: 'Proyectos',
    icon: <FolderKanban size={16} strokeWidth={1.8} />,
    href: (basePath: string, teamId: string) => `${basePath}/teams/${teamId}/projects`
  },
  {
    id: 'members',
    label: 'Miembros',
    icon: <UsersRound size={16} strokeWidth={1.8} />,
    href: (basePath: string, teamId: string) => `${basePath}/teams/${teamId}/members`
  },
  {
    id: 'settings',
    label: 'Configuración',
    icon: <Settings2 size={16} strokeWidth={1.8} />,
    href: (basePath: string, teamId: string) => `${basePath}/teams/${teamId}/settings`
  },
];

function TeamsDropdown({ basePath, teamsApiUrl }: { basePath: string; teamsApiUrl: string }) {
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
        const token = localStorage.getItem('accessToken');
        const res = await fetch(teamsApiUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
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
  }, [teamsApiUrl]);

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
        <ChevronRight
          size={14}
          strokeWidth={1.8}
          className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : 'rotate-0'}`}
          aria-hidden="true"
        />
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
              const isTeamActive = pathname.startsWith(`${basePath}/teams/${team.id}`);
              
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
                    <ChevronRight
                      size={13}
                      strokeWidth={1.8}
                      className={`transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
                      style={{ color: colors.textMuted }}
                      aria-hidden="true"
                    />

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
                      <MoreVertical size={14} aria-hidden="true" />
                    </button>
                  </div>

                  {/* Suboptions (when expanded) */}
                  {isExpanded && (
                    <div className="ml-4 mt-1 space-y-0.5 border-l-2 pl-2" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                      {TEAM_SUBOPTIONS.map((option) => {
                        const optionPath = option.href(basePath, team.id);
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
            href={`${basePath}/teams`}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all group mt-2"
            style={{ color: colors.textMuted }}
          >
            <div
              className="w-5 h-5 rounded flex items-center justify-center"
              style={{ border: `1.5px dashed ${colors.textMuted}` }}
            >
              <Plus size={12} strokeWidth={1.8} aria-hidden="true" />
            </div>
            <span className="text-sm group-hover:text-[#00D4B3] transition-colors">
              Ver equipos
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
  orgSlug?: string; // When set, uses workspace routes instead of /admin
  userRole?: string; // iris_role: 'owner' | 'admin' | 'manager' | 'leader' | 'member'
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ isCollapsed, onToggle, isMobile, isMobileOpen, onMobileClose, orgSlug, userRole }) => {
  const pathname = usePathname();
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;

  // Determine if user is admin/owner for workspace context
  const isAdminRole = userRole === 'owner' || userRole === 'admin';

  // Determine base path and API URL based on context and role
  // Admin/owner: /slug/admin/*  |  Member: /slug/*  |  Global: /admin
  const basePath = orgSlug
    ? (isAdminRole ? `/${orgSlug}/admin` : `/${orgSlug}`)
    : '/admin';
  const teamsApiUrl = orgSlug ? `/api/workspaces/${orgSlug}/teams?limit=50` : '/api/admin/teams?limit=50';

  // Select menu items based on role
  const selectedMenuItems = getMenuForRole(userRole, Boolean(orgSlug));
  const menuItems = selectedMenuItems.map(item => ({
    ...item,
    href: item.path ? `${basePath}${item.path}` : `${basePath}/dashboard`,
  }));

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
        className={`${shellStyles.sidebar} ${!isMobile && isCollapsed ? shellStyles.sidebarCollapsed : ''}`}
        style={{
          transform: isMobile
            ? (isMobileOpen ? 'translateX(0)' : 'translateX(calc(-100% - 1rem))')
            : 'translateX(0)',
        }}
      >
        <div className={`${shellStyles.sidebarHeader} ${!isMobile && isCollapsed ? shellStyles.sidebarHeaderCollapsed : ''}`}>
          {(!isCollapsed || isMobile) && (
            <Link href={`${basePath}/dashboard`} className={shellStyles.brandLink} onClick={handleNavClick}>
              <span className={shellStyles.brandLogo}>
                <img src="/Logo.png" alt="" className="w-full h-full object-contain" />
              </span>
              <span style={{ color: colors.textPrimary }} className={shellStyles.brandName}>Project Hub</span>
            </Link>
          )}

          <button
            type="button"
            onClick={isMobile ? onMobileClose : onToggle}
            className={`${shellStyles.sidebarToggle} ${!isMobile && isCollapsed ? shellStyles.sidebarToggleCollapsed : ''}`}
            aria-label={isMobile || !isCollapsed ? 'Cerrar menú lateral' : 'Abrir menú lateral'}
            title={isMobile || !isCollapsed ? 'Cerrar menú lateral' : 'Abrir menú lateral'}
          >
            {isMobile || !isCollapsed
              ? <PanelLeftClose size={19} strokeWidth={1.8} aria-hidden="true" />
              : <PanelLeftOpen size={20} strokeWidth={1.8} aria-hidden="true" />}
          </button>
        </div>

        <div className={shellStyles.sidebarDivider} aria-hidden="true" />

        {/* Scrollable middle section */}
        <div
          className={`flex-1 min-h-0 ${!isMobile && isCollapsed ? 'overflow-visible' : 'overflow-y-auto overflow-x-hidden'}`}
        >
          {/* Navigation */}
          <nav className={shellStyles.sidebarNav} aria-label="Navegación principal">
            {menuItems.map((item) => {
              const isActive = item.id === 'dashboard'
                ? pathname === `${basePath}/dashboard`
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={handleNavClick}
                  className={`${shellStyles.navItem} ${!isMobile && isCollapsed ? shellStyles.navItemCollapsed : ''} group`}
                  style={{
                    background: isActive
                      ? 'linear-gradient(135deg, #0ad8bd 0%, #00c6ad 100%)'
                      : 'transparent',
                    color: isActive ? '#071512' : colors.textSecondary,
                  }}
                >
                  {/* Icon */}
                  <span className={`${shellStyles.navIcon} ${isActive ? 'text-[#071512]' : 'group-hover:text-[#00D4B3]'}`}>
                    {icons[item.icon]}
                  </span>

                  {/* Label */}
                  {(!isCollapsed || isMobile) && (
                    <span className="font-medium text-sm" style={{ color: isActive ? '#071512' : colors.textSecondary }}>
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
                    <div className={shellStyles.navTooltip} role="tooltip">
                      {item.label}
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Teams Section - Similar to Linear */}
          {(!isCollapsed || isMobile) && <TeamsDropdown basePath={basePath} teamsApiUrl={teamsApiUrl} />}
        </div>

        {/* Bottom Section - User Profile with Menu (fixed at bottom) */}
        <div className="flex-shrink-0">
          <UserProfileMenu isCollapsed={isMobile ? false : isCollapsed} basePath={basePath} />
        </div>
      </aside>
    </>
  );
};

// User Profile Menu Component
function UserProfileMenu({ isCollapsed, basePath }: { isCollapsed: boolean; basePath: string }) {
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
    <div className={`relative ${isCollapsed ? 'px-2 py-2' : 'px-3 py-3'}`} style={{ overflow: 'visible' }}>
      {/* User Menu Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div 
            className="absolute bottom-full mb-2 rounded-xl border overflow-hidden shadow-xl z-40"
            style={{ 
              backgroundColor: isDark ? '#1E2329' : colors.bgCard, 
              borderColor: colors.border,
              ...(isCollapsed 
                ? { left: 0, minWidth: '220px' }
                : { left: 0, right: 0 }
              ),
            }}
          >
            {/* Edit Profile */}
            <Link
              href={basePath === '/admin' ? '/admin/profile' : `${basePath}/profile`}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-3 transition-colors whitespace-nowrap"
              style={{ color: colors.textSecondary }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <UserRound size={18} strokeWidth={1.8} aria-hidden="true" />
              <span className="text-sm">Editar perfil</span>
            </Link>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 transition-colors whitespace-nowrap"
              style={{ color: colors.textSecondary }}
            >
              <div className="flex items-center gap-3">
                {isDark ? (
                  <Moon size={18} strokeWidth={1.8} aria-hidden="true" />
                ) : (
                  <Sun size={18} strokeWidth={1.8} aria-hidden="true" />
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
              className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors whitespace-nowrap"
            >
              <LogOut size={18} strokeWidth={1.8} aria-hidden="true" />
              <span className="text-sm">Cerrar sesión</span>
            </button>
          </div>
        </>
      )}

      {/* User Card */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`rounded-xl transition-all duration-200 cursor-pointer ${isCollapsed ? 'p-1.5' : 'p-3'}`}
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
                <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
                <MoreVertical size={16} strokeWidth={1.8} aria-hidden="true" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminSidebar;

