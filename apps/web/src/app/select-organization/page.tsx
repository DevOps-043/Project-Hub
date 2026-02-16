'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Building2, ChevronRight, Shield, LogOut, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useAuthStore, WorkspaceInfo } from '@/core/stores/authStore';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  manager: 'Gerente',
  leader: 'Líder',
  member: 'Miembro',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  leader: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  member: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

export default function SelectOrganizationPage() {
  const router = useRouter();
  const { user, workspaces, isAuthenticated, isInitialized, logout, initialize } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [fetchedWorkspaces, setFetchedWorkspaces] = useState<WorkspaceInfo[]>([]);

  useEffect(() => {
    const init = async () => {
      if (!isInitialized) {
        await initialize();
      }
      setIsLoading(false);
    };
    init();
  }, [isInitialized, initialize]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/sign-in');
      return;
    }

    // Si tenemos workspaces del store, usarlos
    if (workspaces.length > 0) {
      setFetchedWorkspaces(workspaces);
      return;
    }

    // Si no hay workspaces en el store, intentar fetch del API
    if (isAuthenticated && workspaces.length === 0) {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (token) {
        fetch('/api/workspaces', {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.workspaces) {
              const mapped: WorkspaceInfo[] = data.workspaces.map((ws: any) => ({
                id: ws.id,
                name: ws.name,
                slug: ws.slug,
                logoUrl: ws.logoUrl,
                role: ws.role,
              }));
              setFetchedWorkspaces(mapped);
              useAuthStore.getState().setWorkspaces(mapped);
            }
          })
          .catch(console.error);
      }
    }
  }, [isLoading, isAuthenticated, workspaces, router]);

  const handleSelectOrg = (workspace: WorkspaceInfo) => {
    router.push(`/${workspace.slug}/dashboard`);
  };

  const handleLogout = async () => {
    await logout();
    router.push('/auth/sign-in');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0A0D12]">
        <Loader2 className="w-8 h-8 animate-spin text-[#0A2540] dark:text-[#00D4B3]" />
      </div>
    );
  }

  const displayWorkspaces = fetchedWorkspaces.length > 0 ? fetchedWorkspaces : workspaces;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F8FAFC] dark:bg-[#0A0D12] relative">
      {/* Patrón de fondo */}
      <div
        className="fixed inset-0 opacity-[0.02] dark:opacity-[0.05] pointer-events-none text-[#0A2540] dark:text-gray-600"
        style={{
          backgroundImage: `linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-xl"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/Logo.png" alt="Project Hub" width={64} height={64} className="w-16 h-16" />
          </div>
          <h1 className="text-2xl font-bold text-[#0A2540] dark:text-white mb-2">
            Selecciona tu organización
          </h1>
          <p className="text-[#6B7280] dark:text-gray-400">
            Hola, <span className="font-medium text-[#0A2540] dark:text-white">{user?.name || user?.email}</span>. Elige el espacio de trabajo al que deseas acceder.
          </p>
        </div>

        {/* Lista de organizaciones */}
        <div className="space-y-3">
          {displayWorkspaces.length === 0 ? (
            <div className="bg-white dark:bg-[#1E2329] rounded-xl p-8 text-center border border-[#E5E7EB] dark:border-white/10">
              <Building2 className="w-12 h-12 mx-auto mb-3 text-[#9CA3AF]" />
              <p className="text-[#6B7280] dark:text-gray-400 mb-1">
                No tienes organizaciones asignadas.
              </p>
              <p className="text-sm text-[#9CA3AF]">
                Contacta a tu administrador para obtener acceso.
              </p>
            </div>
          ) : (
            displayWorkspaces.map((workspace, index) => (
              <motion.button
                key={workspace.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.08 }}
                onClick={() => handleSelectOrg(workspace)}
                className="w-full bg-white dark:bg-[#1E2329] rounded-xl p-4 border border-[#E5E7EB] dark:border-white/10 hover:border-[#0A2540] dark:hover:border-[#00D4B3] hover:shadow-md transition-all flex items-center gap-4 group text-left"
              >
                {/* Logo/Avatar de la org */}
                <div className="w-12 h-12 rounded-lg bg-[#F3F4F6] dark:bg-[#0F1419] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {workspace.logoUrl ? (
                    <Image
                      src={workspace.logoUrl}
                      alt={workspace.name}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <Building2 className="w-6 h-6 text-[#9CA3AF]" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[#0A2540] dark:text-white truncate">
                    {workspace.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        ROLE_COLORS[workspace.role] || ROLE_COLORS.member
                      }`}
                    >
                      <Shield className="w-3 h-3" />
                      {ROLE_LABELS[workspace.role] || workspace.role}
                    </span>
                    <span className="text-xs text-[#9CA3AF]">/{workspace.slug}</span>
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight className="w-5 h-5 text-[#9CA3AF] group-hover:text-[#0A2540] dark:group-hover:text-[#00D4B3] transition-colors flex-shrink-0" />
              </motion.button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 text-sm text-[#9CA3AF] hover:text-red-500 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </motion.div>
    </div>
  );
}
