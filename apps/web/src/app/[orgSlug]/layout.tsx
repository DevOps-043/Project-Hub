'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminNavbar } from '@/components/admin/AdminNavbar';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { WorkspaceProvider, WorkspaceData, WorkspaceRole } from '@/contexts/WorkspaceContext';
import { api } from '@/lib/api/client';
import { Building2, ShieldAlert } from 'lucide-react';
import shellStyles from '@/components/admin/AdminShell.module.css';
import { resolveOrganizationTheme } from '@/lib/theme/organization-brand';
import { SystemState } from '@/components/system/SystemState';

const MOBILE_BREAKPOINT = 1024;

interface WorkspaceLayoutProps {
  children: React.ReactNode;
}

function WorkspaceLayoutContent({ children }: WorkspaceLayoutProps) {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [userRole, setUserRole] = useState<WorkspaceRole>('member');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch workspace data
  useEffect(() => {
    if (!orgSlug) return;

    const fetchWorkspace = async () => {
      try {
        const { data, status } = await api.get<{ workspace: WorkspaceData; userRole: WorkspaceRole }>(
          `/api/workspaces/${orgSlug}`
        );

        if (status === 404) {
          setError('not_found');
          setIsLoading(false);
          return;
        }

        if (status === 403) {
          setError('forbidden');
          setIsLoading(false);
          return;
        }

        if (!data) {
          setError('error');
          setIsLoading(false);
          return;
        }

        setWorkspace(data.workspace);
        setUserRole(data.userRole as WorkspaceRole);
        setIsLoading(false);
      } catch {
        setError('error');
        setIsLoading(false);
      }
    };

    fetchWorkspace();
  }, [orgSlug]);

  // Detect mobile breakpoint
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const mobile = e.matches;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarCollapsed(true);
        setIsMobileOpen(false);
      }
    };

    handleChange(mql);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setIsMobileOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  }, [isMobile]);

  const closeMobileSidebar = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  if (isLoading) {
    return <SystemState loading eyebrow="Organización" title="Preparando tu espacio" description="Estamos sincronizando permisos, identidad y preferencias de diseño." />;
  }

  if (error === 'not_found') {
    return <SystemState icon={Building2} eyebrow="Organización" title="No encontramos este espacio" description={`El espacio “${orgSlug}” no existe o dejó de estar disponible.`} action={<button type="button" onClick={() => router.push('/select-organization')}>Elegir otra organización</button>} />;
  }

  if (error === 'forbidden') {
    return <SystemState icon={ShieldAlert} eyebrow="Acceso restringido" title="No tienes acceso a este espacio" description="Tu cuenta está activa, pero no pertenece a esta organización." action={<button type="button" onClick={() => router.push('/select-organization')}>Elegir otra organización</button>} />;
  }

  if (!workspace) return null;

  return (
    <WorkspaceProvider workspace={workspace} userRole={userRole}>
      <div
        className={shellStyles.shell}
        data-sofia-shell="true"
        style={resolveOrganizationTheme(workspace.brandColor, workspace.settings)}
      >
          <AdminSidebar
            isCollapsed={isMobile ? false : sidebarCollapsed}
            onToggle={toggleSidebar}
            isMobile={isMobile}
            isMobileOpen={isMobileOpen}
            onMobileClose={closeMobileSidebar}
            orgSlug={orgSlug}
            userRole={userRole}
          />

          <AdminNavbar
            sidebarCollapsed={sidebarCollapsed}
            onMenuClick={toggleSidebar}
            isMobile={isMobile}
            workspaceLogo={workspace.logoUrl || null}
            workspaceName={workspace.name}
          />

          <main
            className={`${shellStyles.main} ${!isMobile && sidebarCollapsed ? shellStyles.mainCollapsed : ''}`}
          >
            <div className={shellStyles.content}>{children}</div>
          </main>

      </div>
    </WorkspaceProvider>
  );
}

export default function WorkspaceLayout({ children }: WorkspaceLayoutProps) {
  return (
    <AuthGuard>
      <WorkspaceLayoutContent>{children}</WorkspaceLayoutContent>
    </AuthGuard>
  );
}
