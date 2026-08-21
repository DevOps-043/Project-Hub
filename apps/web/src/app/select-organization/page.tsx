'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Building2, LogOut, ShieldCheck } from 'lucide-react';
import { useAuthStore, type WorkspaceInfo } from '@/core/stores/authStore';
import { api } from '@/lib/api/client';
import { LoadingState } from '@/components/product';
import styles from './SelectOrganization.module.css';

const roleLabels: Record<string, string> = { owner: 'Propietario', admin: 'Administrador', manager: 'Gerente', leader: 'Líder', member: 'Miembro' };

export default function SelectOrganizationPage() {
  const router = useRouter();
  const { user, workspaces, isAuthenticated, isInitialized, logout, initialize, setWorkspaces } = useAuthStore();
  const [loading, setLoading] = useState(true); const [available, setAvailable] = useState<WorkspaceInfo[]>([]);
  useEffect(() => { (async () => { if (!isInitialized) await initialize(); setLoading(false); })(); }, [initialize, isInitialized]);
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.replace('/auth/sign-in'); return; }
    if (workspaces.length) { setAvailable(workspaces); return; }
    api.get<{ workspaces?: WorkspaceInfo[] }>('/api/workspaces').then((response) => { if (response.data?.workspaces) { setAvailable(response.data.workspaces); setWorkspaces(response.data.workspaces); } });
  }, [isAuthenticated, loading, router, setWorkspaces, workspaces]);
  if (loading) return <LoadingState label="Consultando tus organizaciones…" />;
  return <main className={styles.page}><div className={styles.ambient} aria-hidden="true" /><section className={styles.shell}><header><div className={styles.brand}><span>S</span><div><strong>Project Hub</strong><small>by SofLIA</small></div></div><button type="button" onClick={async () => { await logout(); router.push('/auth/sign-in'); }}><LogOut size={15} aria-hidden /> Cerrar sesión</button></header><div className={styles.intro}><span>Espacios de trabajo</span><h1>Elige una organización</h1><p>Hola, {user?.name || user?.email}. Selecciona el entorno en el que quieres continuar.</p></div>{available.length ? <div className={styles.list}>{available.map((workspace) => <button key={workspace.id} type="button" onClick={() => router.push(`/${workspace.slug}/dashboard`)}><span className={styles.workspaceMark}>{workspace.logoUrl ? <img src={workspace.logoUrl} alt="" /> : <Building2 size={20} aria-hidden />}</span><span><strong>{workspace.name}</strong><small><ShieldCheck size={12} aria-hidden /> {roleLabels[workspace.role] || workspace.role}</small></span><ArrowRight size={17} aria-hidden /></button>)}</div> : <div className={styles.empty}><Building2 size={25} aria-hidden /><h2>No hay organizaciones asignadas</h2><p>Solicita a un administrador que te agregue a un espacio de trabajo.</p></div>}<footer><span>Acceso seguro</span><span>{available.length} {available.length === 1 ? 'organización disponible' : 'organizaciones disponibles'}</span></footer></section></main>;
}
