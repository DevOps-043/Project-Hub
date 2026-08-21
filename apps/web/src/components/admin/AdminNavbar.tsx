'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronDown,
  FolderKanban,
  LoaderCircle,
  Menu,
  Search,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { NotificationCenter } from '@/features/notifications/NotificationCenter';
import { api } from '@/lib/api/client';
import shellStyles from './AdminShell.module.css';
import styles from './AdminNavbar.module.css';

interface SearchResult {
  type: string;
  id: string;
  url: string;
  avatar?: string;
  title: string;
  subtitle: string;
}
interface WorkspaceOption {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  role?: string;
}

interface WorkspacesResponse { workspaces?: WorkspaceOption[] }


interface AdminNavbarProps {
  sidebarCollapsed: boolean;
  onMenuClick: () => void;
  isMobile?: boolean;
  workspaceLogo?: string | null;
  workspaceName?: string;
}

const resultIcons = {
  project: FolderKanban,
  task: BriefcaseBusiness,
  user: UserRound,
  team: UsersRound,
};

function getPanelBase(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'admin') return '/admin';
  if (segments[1] === 'admin') return `/${segments[0]}/admin`;
  return segments[0] ? `/${segments[0]}` : '/admin';
}

export function AdminNavbar({
  sidebarCollapsed,
  onMenuClick,
  isMobile = false,
  workspaceLogo,
  workspaceName,
}: AdminNavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const panelBase = useMemo(() => getPanelBase(pathname), [pathname]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const workspaceSwitcherRef = useRef<HTMLDivElement>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const quickActions = useMemo(() => [
    { label: 'Usuarios', shortcut: 'U', href: `${panelBase}/${panelBase === '/admin' ? 'users' : 'members'}` },
    { label: 'Proyectos', shortcut: 'P', href: `${panelBase}/projects` },
    { label: 'Analítica', shortcut: 'A', href: `${panelBase}/analytics` },
  ], [panelBase]);

  useEffect(() => {
    let active = true;
    api.get<WorkspacesResponse>('/api/workspaces').then((response) => {
      if (!active || response.error) return;
      setWorkspaces(response.data?.workspaces || []);
    });
    return () => { active = false; };
  }, []);

  const workspaceDestination = (workspace: WorkspaceOption) => (
    ['owner', 'admin'].includes(workspace.role || '')
      ? `/${workspace.slug}/admin/dashboard` : `/${workspace.slug}/dashboard`
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      const query = searchValue.trim();
      if (query.length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const response = await api.get<SearchResult[]>(`/api/search?q=${encodeURIComponent(query)}`);
        setSearchResults(response.error || !response.data ? [] : response.data);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!searchContainerRef.current?.contains(event.target as Node)) setIsSearchOpen(false);
      if (!workspaceSwitcherRef.current?.contains(event.target as Node)) setIsWorkspaceMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsSearchOpen(true);
        window.requestAnimationFrame(() => inputRef.current?.focus());
      }
      if (event.key === 'Escape') {
        setIsSearchOpen(false);
        setIsWorkspaceMenuOpen(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const navigate = (href: string) => {
    router.push(href);
    setIsSearchOpen(false);
    setSearchValue('');
  };

  return (
    <header
      className={`${shellStyles.navbar} ${!isMobile && sidebarCollapsed ? shellStyles.navbarCollapsed : ''}`}
      aria-label="Barra superior del workspace"
    >
      <div className={styles.identityGroup}>
        {isMobile ? (
          <button type="button" className={styles.iconButton} onClick={onMenuClick} aria-label="Abrir navegación">
            <Menu size={19} strokeWidth={1.8} aria-hidden="true" />
          </button>
        ) : null}

        <div ref={workspaceSwitcherRef} className={styles.workspaceSwitcher}>
          <button
            type="button"
            className={styles.workspaceIdentity}
            onClick={() => setIsWorkspaceMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={isWorkspaceMenuOpen}
          >
            <span className={styles.logoStage}>
              <img src={workspaceLogo || '/Logo.png'} alt="" />
            </span>
            <span className={styles.workspaceCopy}>
              <strong>{workspaceName || 'Project Hub'}</strong>
              <small>Centro de proyectos</small>
            </span>
            {workspaces.length > 1 ? <ChevronDown className={styles.switcherChevron} size={15} aria-hidden="true" /> : null}
          </button>

          {isWorkspaceMenuOpen ? (
            <div className={styles.workspaceMenu} role="menu" aria-label="Cambiar organización">
              <span className={styles.panelLabel}>Organizaciones</span>
              <div className={styles.workspaceList}>
                {workspaces.map((workspace) => {
                  const isCurrent = pathname.startsWith(`/${workspace.slug}/`);
                  return (
                    <button
                      key={workspace.id}
                      type="button"
                      className={styles.workspaceOption}
                      data-current={isCurrent}
                      onClick={() => {
                        router.push(workspaceDestination(workspace));
                        setIsWorkspaceMenuOpen(false);
                      }}
                      role="menuitem"
                    >
                      <span className={styles.workspaceOptionLogo}>
                        {workspace.logoUrl ? <img src={workspace.logoUrl} alt="" /> : <Building2 size={17} aria-hidden="true" />}
                      </span>
                      <span><strong>{workspace.name}</strong><small>{workspace.role || 'miembro'}</small></span>
                      {isCurrent ? <Check size={16} aria-label="Organización actual" /> : null}
                    </button>
                  );
                })}
              </div>
              <button type="button" className={styles.manageOrganizations} onClick={() => navigate('/select-organization')}>
                Ver todas las organizaciones <ArrowUpRight size={14} aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.actionGroup}>
        <div ref={searchContainerRef} className={styles.searchContainer} data-open={isSearchOpen ? 'true' : 'false'}>
          <div className={styles.searchField}>
            {isSearching ? (
              <LoaderCircle className={styles.spinner} size={17} aria-label="Buscando" />
            ) : (
              <Search size={17} strokeWidth={1.8} aria-hidden="true" />
            )}
            <input
              ref={inputRef}
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              onFocus={() => setIsSearchOpen(true)}
              placeholder="Buscar tareas, proyectos o personas"
              aria-label="Buscar en Project Hub"
              aria-controls="project-hub-search-results"
            />
            {!isSearchOpen ? <kbd>⌘K</kbd> : null}
          </div>

          {isSearchOpen ? (
            <div id="project-hub-search-results" className={styles.searchPanel} role="dialog" aria-label="Búsqueda global">
              {searchValue.trim().length >= 2 ? (
                <div>
                  <p className={styles.panelLabel}>Resultados</p>
                  {isSearching ? (
                    <p className={styles.panelMessage}>Buscando coincidencias…</p>
                  ) : searchResults.length ? (
                    <div className={styles.resultList}>
                      {searchResults.map((result) => {
                        const ResultIcon = resultIcons[result.type as keyof typeof resultIcons] || Search;
                        return (
                          <button
                            key={`${result.type}-${result.id}`}
                            type="button"
                            className={styles.resultItem}
                            onClick={() => navigate(result.url)}
                          >
                            <span className={styles.resultIcon}>
                              {result.avatar ? (
                                <img src={result.avatar} alt="" />
                              ) : (
                                <ResultIcon size={16} strokeWidth={1.8} aria-hidden="true" />
                              )}
                            </span>
                            <span className={styles.resultCopy}>
                              <strong>{result.title}</strong>
                              <small>{result.subtitle}</small>
                            </span>
                            <span className={styles.resultType}>{result.type}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className={styles.panelMessage}>No encontramos resultados para “{searchValue}”.</p>
                  )}
                </div>
              ) : (
                <div>
                  <p className={styles.panelLabel}>Acciones rápidas</p>
                  <div className={styles.resultList}>
                    {quickActions.map((action) => (
                      <button key={action.label} type="button" className={styles.quickAction} onClick={() => navigate(action.href)}>
                        <span>{action.label}</span>
                        <span className={styles.quickMeta}><kbd>{action.shortcut}</kbd><ArrowUpRight size={14} aria-hidden="true" /></span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className={styles.searchFooter}><kbd>Esc</kbd><span>para cerrar</span></div>
            </div>
          ) : null}
        </div>

        <NotificationCenter />
      </div>
    </header>
  );
}

export default AdminNavbar;
