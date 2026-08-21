'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BriefcaseBusiness,
  ChartSpline,
  ChevronRight,
  ContactRound,
  FileChartColumn,
  House,
  ListChecks,
  LogOut,
  Moon,
  MoreVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sun,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/core/stores/authStore';
import { api } from '@/lib/api/client';
import shellStyles from './AdminShell.module.css';
import styles from './AdminSidebar.module.css';

const icons = {
  dashboard: House,
  users: ContactRound,
  projects: BriefcaseBusiness,
  teams: UsersRound,
  tasks: ListChecks,
  analytics: ChartSpline,
  reports: FileChartColumn,
};

interface MenuItem {
  id: keyof typeof icons;
  label: string;
  path: string;
}

const ownerMenuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Panel', path: '' },
  { id: 'users', label: 'Usuarios', path: '/members' },
  { id: 'teams', label: 'Equipos', path: '/teams' },
  { id: 'tasks', label: 'Tareas', path: '/tasks' },
  { id: 'projects', label: 'Proyectos', path: '/projects' },
  { id: 'analytics', label: 'Analítica', path: '/analytics' },
  { id: 'reports', label: 'Reportes', path: '/reports' },
];

const roleMenus: Record<string, MenuItem[]> = {
  owner: ownerMenuItems,
  admin: ownerMenuItems,
  manager: ownerMenuItems.filter((item) => !['users', 'analytics'].includes(item.id)),
  leader: ownerMenuItems
    .filter((item) => !['users', 'analytics'].includes(item.id))
    .map((item) => item.id === 'teams' ? { ...item, label: 'Mis equipos' } : item.id === 'projects' ? { ...item, label: 'Mis proyectos' } : item),
  member: ownerMenuItems
    .filter((item) => !['users', 'analytics'].includes(item.id))
    .map((item) => item.id === 'teams' ? { ...item, label: 'Mis equipos' } : item.id === 'projects' ? { ...item, label: 'Mis proyectos' } : item),
};

interface Team {
  id: string;
  name: string;
  color: string;
  memberCount: number;
}


interface AdminSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  orgSlug?: string;
  userRole?: string;
}

function TeamNavigator({ basePath, teamsApiUrl, onNavigate }: { basePath: string; teamsApiUrl: string; onNavigate: () => void }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchTeams = async () => {
      try {
        const response = await api.get<{ teams: Team[] }>(teamsApiUrl);
        if (active && !response.error && response.data?.teams) setTeams(response.data.teams);
      } catch {
        if (active) setTeams([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchTeams();
    return () => { active = false; };
  }, [teamsApiUrl]);

  return (
    <section className={styles.teamSection} aria-labelledby="sidebar-teams-label">
      <button
        type="button"
        className={styles.sectionToggle}
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls="sidebar-team-list"
      >
        <span id="sidebar-teams-label">Tus equipos</span>
        <ChevronRight className={isOpen ? styles.chevronOpen : ''} size={14} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div id="sidebar-team-list" className={styles.teamList}>
          {loading ? (
            <div className={styles.teamSkeletons} aria-label="Cargando equipos">
              <span /><span /><span />
            </div>
          ) : teams.length ? teams.map((team) => {
            const active = pathname.startsWith(`${basePath}/teams/${team.id}`);
            return (
              <div key={team.id} className={styles.teamGroup}>
                <Link
                  href={`${basePath}/teams/${team.id}`}
                  className={styles.teamButton}
                  data-active={active ? 'true' : 'false'}
                  onClick={onNavigate}
                >
                  <ChevronRight size={13} aria-hidden="true" />
                  <span className={styles.teamAvatar} style={{ backgroundColor: team.color }} aria-hidden="true">
                    {team.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className={styles.teamName}>{team.name}</span>
                  {team.memberCount ? <span className={styles.teamCount}>{team.memberCount}</span> : null}
                </Link>
              </div>
            );
          }) : <p className={styles.noTeams}>Aún no hay equipos.</p>}

          <Link href={`${basePath}/teams`} className={styles.allTeamsLink} onClick={onNavigate}>
            <span className={styles.addTeamIcon}><Plus size={12} aria-hidden="true" /></span>
            <span>Ver equipos</span>
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function UserProfileMenu({ isCollapsed, basePath }: { isCollapsed: boolean; basePath: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuthStore();

  const initials = useMemo(() => {
    const parts = (user?.name || 'Usuario').trim().split(/\s+/);
    return `${parts[0]?.[0] || 'U'}${parts[1]?.[0] || ''}`.toUpperCase();
  }, [user?.name]);

  const roleLabel = user?.companyRole || (user?.role === 'admin' ? 'Administrador' : user?.role === 'user' ? 'Miembro' : 'Invitado');

  const handleLogout = async () => {
    await logout();
    router.push('/auth/sign-in');
  };

  return (
    <div className={styles.profileArea} data-collapsed={isCollapsed ? 'true' : 'false'}>
      {isOpen ? <button className={styles.userMenuBackdrop} type="button" onClick={() => setIsOpen(false)} aria-label="Cerrar menú de usuario" /> : null}
      {isOpen ? (
        <div className={styles.userMenu} role="menu" aria-label="Menú de usuario">
          <div className={styles.userMenuIdentity}>
            <span className={styles.menuAvatar}>{user?.avatar ? (
              <img src={user.avatar} alt="" referrerPolicy="no-referrer" />
            ) : initials}</span>
            <span><strong>{user?.name || 'Usuario'}</strong><small>{roleLabel}</small></span>
          </div>
          <div className={styles.menuDivider} />
          <Link role="menuitem" className={styles.menuItem} href={`${basePath}/profile`} onClick={() => setIsOpen(false)}>
            <UserRound size={17} strokeWidth={1.8} aria-hidden="true" /><span>Editar perfil</span>
          </Link>
          <button role="menuitem" type="button" className={styles.menuItem} onClick={toggleTheme}>
            {isDark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
            <span>{isDark ? 'Usar modo claro' : 'Usar modo oscuro'}</span>
          </button>
          <div className={styles.menuDivider} />
          <button role="menuitem" type="button" className={`${styles.menuItem} ${styles.logoutItem}`} onClick={handleLogout}>
            <LogOut size={17} strokeWidth={1.8} aria-hidden="true" /><span>Cerrar sesión</span>
          </button>
        </div>
      ) : null}

      <button
        type="button"
        className={styles.profileButton}
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Cerrar menú de usuario' : 'Abrir menú de usuario'}
      >
        <span className={styles.profileAvatar}>{user?.avatar ? (
          <img src={user.avatar} alt="" referrerPolicy="no-referrer" />
        ) : initials}<span className={styles.profilePresence} /></span>
        {!isCollapsed ? (
          <>
            <span className={styles.profileCopy}><strong>{user?.name || 'Usuario'}</strong><small>{roleLabel}</small></span>
            <MoreVertical size={16} aria-hidden="true" />
          </>
        ) : null}
      </button>
    </div>
  );
}

export function AdminSidebar({
  isCollapsed,
  onToggle,
  isMobile = false,
  isMobileOpen = false,
  onMobileClose,
  orgSlug,
  userRole,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const isAdminRole = userRole === 'owner' || userRole === 'admin';
  const basePath = orgSlug ? (isAdminRole ? `/${orgSlug}/admin` : `/${orgSlug}`) : '/admin';
  const teamsApiUrl = orgSlug ? `/api/workspaces/${orgSlug}/teams?limit=50` : '/api/admin/teams?limit=50';
  const menuItems = orgSlug ? (roleMenus[userRole || 'member'] || roleMenus.member) : ownerMenuItems;

  const hrefFor = (item: MenuItem) => {
    if (item.id === 'dashboard') return orgSlug ? `${basePath}/dashboard` : '/admin';
    if (item.id === 'users' && !orgSlug) return '/admin/users';
    return `${basePath}${item.path}`;
  };

  const closeOnMobile = () => { if (isMobile) onMobileClose?.(); };

  return (
    <>
      {isMobile && isMobileOpen ? (
        <button type="button" className={styles.mobileBackdrop} onClick={onMobileClose} aria-label="Cerrar navegación" />
      ) : null}

      <aside
        className={`${shellStyles.sidebar} ${!isMobile && isCollapsed ? shellStyles.sidebarCollapsed : ''}`}
        data-collapsed={!isMobile && isCollapsed ? 'true' : 'false'}
        style={{ transform: isMobile && !isMobileOpen ? 'translateX(calc(-100% - 1rem))' : 'translateX(0)' }}
        aria-label="Navegación principal"
      >
        <div className={styles.sidebarHeader}>
          {!isCollapsed || isMobile ? (
            <Link href={orgSlug ? `${basePath}/dashboard` : '/admin'} className={styles.brandLink} onClick={closeOnMobile}>
              <span className={styles.brandMark}>
                <img src="/Logo.png" alt="" />
              </span>
              <span className={styles.brandCopy}><strong>Project Hub</strong><small>by SofLIA</small></span>
            </Link>
          ) : null}
          <button type="button" onClick={isMobile ? onMobileClose : onToggle} className={styles.collapseButton} aria-label={isMobile || !isCollapsed ? 'Cerrar navegación' : 'Abrir navegación'}>
            {isMobile || !isCollapsed ? <PanelLeftClose size={18} aria-hidden="true" /> : <PanelLeftOpen size={18} aria-hidden="true" />}
          </button>
        </div>

        <div className={styles.sidebarDivider} />
        <div className={styles.scrollArea}>
          <nav className={styles.primaryNav} aria-label="Secciones de Project Hub">
            {menuItems.map((item) => {
              const href = hrefFor(item);
              const active = item.id === 'dashboard' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
              const Icon = icons[item.id];
              return (
                <Link key={item.id} href={href} className={styles.navItem} data-active={active ? 'true' : 'false'} onClick={closeOnMobile}>
                  <span className={styles.navIcon}><Icon size={18} strokeWidth={1.8} aria-hidden="true" /></span>
                  {!isCollapsed || isMobile ? <span>{item.label}</span> : null}
                  {!isMobile && isCollapsed ? <span className={styles.tooltip} role="tooltip">{item.label}</span> : null}
                </Link>
              );
            })}
          </nav>
          {!isCollapsed || isMobile ? <TeamNavigator basePath={basePath} teamsApiUrl={teamsApiUrl} onNavigate={closeOnMobile} /> : null}
        </div>

        <UserProfileMenu isCollapsed={!isMobile && isCollapsed} basePath={basePath} />
      </aside>
    </>
  );
}

export default AdminSidebar;
