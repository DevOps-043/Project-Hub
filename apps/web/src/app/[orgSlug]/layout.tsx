'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminNavbar } from '@/components/admin/AdminNavbar';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { WorkspaceProvider, WorkspaceData, IrisRole } from '@/contexts/WorkspaceContext';
import { Loader2 } from 'lucide-react';

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
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;

  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [userRole, setUserRole] = useState<IrisRole>('member');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch workspace data
  useEffect(() => {
    if (!orgSlug) return;

    const fetchWorkspace = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(`/api/workspaces/${orgSlug}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (res.status === 404) {
          setError('not_found');
          setIsLoading(false);
          return;
        }

        if (res.status === 403) {
          setError('forbidden');
          setIsLoading(false);
          return;
        }

        if (!res.ok) {
          setError('error');
          setIsLoading(false);
          return;
        }

        const data = await res.json();
        setWorkspace(data.workspace);
        setUserRole(data.userRole as IrisRole);
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1419]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00D4B3]" />
      </div>
    );
  }

  if (error === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1419] text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Workspace no encontrado</h1>
          <p className="text-gray-400 mb-4">El espacio de trabajo &quot;{orgSlug}&quot; no existe.</p>
          <button
            onClick={() => router.push('/select-organization')}
            className="px-4 py-2 bg-[#00D4B3] text-black rounded-lg font-medium hover:bg-[#00b89c] transition-colors"
          >
            Volver a seleccionar
          </button>
        </div>
      </div>
    );
  }

  if (error === 'forbidden') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1419] text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Sin acceso</h1>
          <p className="text-gray-400 mb-4">No tienes permisos para acceder a este workspace.</p>
          <button
            onClick={() => router.push('/select-organization')}
            className="px-4 py-2 bg-[#00D4B3] text-black rounded-lg font-medium hover:bg-[#00b89c] transition-colors"
          >
            Volver a seleccionar
          </button>
        </div>
      </div>
    );
  }

  if (!workspace) return null;

  return (
    <WorkspaceProvider workspace={workspace} userRole={userRole}>
      <div
        className="min-h-screen transition-colors duration-300"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, #0F1419 0%, #0A0D12 50%, #0F1419 100%)'
            : `linear-gradient(135deg, ${colors.bgSecondary} 0%, ${colors.bgPrimary} 50%, ${colors.bgSecondary} 100%)`,
        }}
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
          className="pt-16 min-h-screen transition-all duration-300 ease-in-out"
          style={{
            paddingLeft: isMobile ? '0px' : sidebarCollapsed ? '72px' : '260px',
          }}
        >
          <div className="p-6">{children}</div>
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
