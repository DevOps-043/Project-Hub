'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, Edit3, Search, ShieldCheck, Trash2, UserPlus, Users, X } from 'lucide-react';
import { api } from '@/lib/api/client';
import { CollectionToolbar, EmptyState, LoadingState, MetricStrip, PageHero, ProductPage, ProductSurface, ToolbarGroup, productControlClass, productInputClass, productInputIconClass, productInputWrapClass, productPrimaryControlClass, type ProductMetric } from '@/components/product';
import styles from './AdminDirectory.module.css';

type PermissionLevel = 'super_admin' | 'admin' | 'manager' | 'user' | 'viewer' | 'guest';
type User = {
  id: string; firstName: string; lastNamePaternal: string; lastNameMaternal: string | null; displayName: string;
  username: string; email: string; permissionLevel: PermissionLevel; companyRole: string | null; department: string | null;
  accountStatus: 'active' | 'inactive' | 'suspended' | 'pending_verification' | 'deleted'; avatarUrl: string | null;
  phoneNumber: string | null; lastLoginAt: string | null; createdAt: string;
};
type UserForm = { firstName: string; lastNamePaternal: string; lastNameMaternal: string; email: string; username: string; password: string; permissionLevel: PermissionLevel; department: string; companyRole: string; phoneNumber: string };

const emptyForm: UserForm = { firstName: '', lastNamePaternal: '', lastNameMaternal: '', email: '', username: '', password: '', permissionLevel: 'user', department: '', companyRole: '', phoneNumber: '' };
const roleLabels: Record<PermissionLevel, string> = { super_admin: 'Superadmin', admin: 'Administrador', manager: 'Manager', user: 'Usuario', viewer: 'Visor', guest: 'Invitado' };

function initials(user: User) { return `${user.firstName?.[0] || ''}${user.lastNamePaternal?.[0] || ''}`.toUpperCase() || 'U'; }

export function AdminUsersDirectory() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editing, setEditing] = useState<User | null | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const params = new URLSearchParams({ page: String(page), limit: '10' });
    if (search.trim()) params.set('search', search.trim());
    const response = await api.get<{ users?: User[]; pagination?: { total?: number } }>(`/api/admin/users?${params}`);
    if (response.error) setError(response.error); else { setUsers(response.data?.users || []); setTotal(response.data?.pagination?.total || 0); }
    setLoading(false);
  }, [page, search]);
  useEffect(() => { const timer = setTimeout(load, 180); return () => clearTimeout(timer); }, [load]);

  const metrics = useMemo<ProductMetric[]>(() => [
    { label: 'Usuarios', value: total, icon: Users },
    { label: 'Activos en esta vista', value: users.filter((user) => user.accountStatus === 'active').length, icon: CheckCircle2, tone: 'success' },
    { label: 'Administradores', value: users.filter((user) => ['admin', 'super_admin'].includes(user.permissionLevel)).length, icon: ShieldCheck, tone: 'info' },
    { label: 'Pendientes', value: users.filter((user) => user.accountStatus === 'pending_verification').length, icon: Clock3, tone: 'warning' },
  ], [total, users]);

  const toggleStatus = async (user: User) => { await api.put(`/api/admin/users/${user.id}`, { accountStatus: user.accountStatus === 'active' ? 'suspended' : 'active' }); await load(); };
  const remove = async (user: User) => { if (!window.confirm(`¿Eliminar a ${user.displayName || user.email}? Esta acción no se puede deshacer.`)) return; await api.delete(`/api/admin/users/${user.id}`); await load(); };

  return <ProductPage>
    <PageHero eyebrow="Administración global" title="Directorio de usuarios" description="Gestiona identidades, permisos y acceso a Project Hub desde una vista clara y auditable." icon={Users} actions={<button type="button" className={productPrimaryControlClass} onClick={() => setEditing(null)}><UserPlus size={16} aria-hidden /> Agregar usuario</button>} />
    <MetricStrip metrics={metrics} />
    <CollectionToolbar><ToolbarGroup><label className={productInputWrapClass}><Search className={productInputIconClass} size={16} aria-hidden /><input className={productInputClass} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar por nombre, usuario o correo…" /></label></ToolbarGroup><span className={styles.resultCount}>{total} registros</span></CollectionToolbar>
    <ProductSurface>
      {loading ? <LoadingState label="Consultando el directorio…" /> : error ? <EmptyState icon={Users} title="No pudimos cargar los usuarios" description={error} action={<button type="button" className={productControlClass} onClick={load}>Reintentar</button>} /> : users.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Usuario</th><th>Rol</th><th>Área</th><th>Estado</th><th>Último acceso</th><th><span className={styles.srOnly}>Acciones</span></th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><div className={styles.person}><span className={styles.avatar}>{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user)}</span><span><strong>{user.displayName || `${user.firstName} ${user.lastNamePaternal}`}</strong><small>{user.email} · @{user.username}</small></span></div></td><td><span className={styles.badge} data-tone="info">{roleLabels[user.permissionLevel]}</span></td><td><strong className={styles.cellTitle}>{user.companyRole || 'Sin puesto'}</strong><small className={styles.cellHint}>{user.department || 'Sin área'}</small></td><td><button type="button" className={styles.statusButton} data-status={user.accountStatus} onClick={() => toggleStatus(user)}><i aria-hidden />{user.accountStatus === 'active' ? 'Activo' : user.accountStatus === 'pending_verification' ? 'Pendiente' : 'Suspendido'}</button></td><td><span className={styles.cellHint}>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin acceso'}</span></td><td><div className={styles.rowActions}><button type="button" onClick={() => setEditing(user)} aria-label={`Editar ${user.displayName}`}><Edit3 size={15} aria-hidden /></button><button type="button" data-danger onClick={() => remove(user)} aria-label={`Eliminar ${user.displayName}`}><Trash2 size={15} aria-hidden /></button></div></td></tr>)}</tbody></table></div> : <EmptyState icon={Users} title="No encontramos usuarios" description="Prueba con otra búsqueda o agrega una nueva identidad." action={<button type="button" className={productPrimaryControlClass} onClick={() => setEditing(null)}><UserPlus size={16} aria-hidden /> Agregar usuario</button>} />}
      {total > 10 ? <footer className={styles.pagination}><span>Página {page} de {Math.ceil(total / 10)}</span><div><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}><ChevronLeft size={16} aria-hidden /></button><button type="button" onClick={() => setPage((value) => value + 1)} disabled={page * 10 >= total}><ChevronRight size={16} aria-hidden /></button></div></footer> : null}
    </ProductSurface>
    {editing !== undefined ? <UserModal user={editing} onClose={() => setEditing(undefined)} onSaved={async () => { setEditing(undefined); await load(); }} /> : null}
  </ProductPage>;
}

function UserModal({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<UserForm>(user ? { firstName: user.firstName, lastNamePaternal: user.lastNamePaternal, lastNameMaternal: user.lastNameMaternal || '', email: user.email, username: user.username, password: '', permissionLevel: user.permissionLevel, department: user.department || '', companyRole: user.companyRole || '', phoneNumber: user.phoneNumber || '' } : emptyForm);
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const update = (key: keyof UserForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError(''); const body: Partial<UserForm> = { ...form }; if (user && !form.password) delete body.password; const response = user ? await api.put(`/api/admin/users/${user.id}`, body) : await api.post('/api/admin/users', body); if (response.error) { setError(response.error); setSaving(false); return; } onSaved(); };
  return <div className={styles.modalLayer} role="presentation"><button type="button" className={styles.backdrop} aria-label="Cerrar" onClick={onClose} /><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="user-modal-title"><header><div><span>Identidad</span><h2 id="user-modal-title">{user ? 'Editar usuario' : 'Crear usuario'}</h2><p>Datos de acceso, perfil y permisos globales.</p></div><button type="button" onClick={onClose} aria-label="Cerrar"><X size={17} aria-hidden /></button></header><form onSubmit={submit}><div className={styles.formGrid}>{error ? <p className={styles.formError}>{error}</p> : null}<Field label="Nombre" value={form.firstName} onChange={(value) => update('firstName', value)} required /><Field label="Apellido paterno" value={form.lastNamePaternal} onChange={(value) => update('lastNamePaternal', value)} required /><Field label="Apellido materno" value={form.lastNameMaternal} onChange={(value) => update('lastNameMaternal', value)} /><Field label="Correo" type="email" value={form.email} onChange={(value) => update('email', value)} required /><Field label="Usuario" value={form.username} onChange={(value) => update('username', value)} required /><Field label={user ? 'Nueva contraseña' : 'Contraseña'} type="password" value={form.password} onChange={(value) => update('password', value)} required={!user} /><label><span>Rol</span><select value={form.permissionLevel} onChange={(event) => update('permissionLevel', event.target.value)}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><Field label="Puesto" value={form.companyRole} onChange={(value) => update('companyRole', value)} /><Field label="Departamento" value={form.department} onChange={(value) => update('department', value)} /><Field label="Teléfono" value={form.phoneNumber} onChange={(value) => update('phoneNumber', value)} /></div><footer><button type="button" className={productControlClass} onClick={onClose}>Cancelar</button><button type="submit" className={productPrimaryControlClass} disabled={saving}>{saving ? 'Guardando…' : user ? 'Guardar cambios' : 'Crear usuario'}</button></footer></form></section></div>;
}

function Field({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} /></label>; }
