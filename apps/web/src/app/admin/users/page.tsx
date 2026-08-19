'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { api } from '@/lib/api/client';

interface User {
  id: string;
  firstName: string;
  lastNamePaternal: string;
  lastNameMaternal: string | null;
  displayName: string;
  username: string;
  email: string;
  permissionLevel: 'super_admin' | 'admin' | 'manager' | 'user' | 'viewer' | 'guest';
  companyRole: string | null;
  department: string | null;
  accountStatus: 'active' | 'inactive' | 'suspended' | 'pending_verification' | 'deleted';
  avatarUrl: string | null;
  phoneNumber: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (search) params.append('search', search);
      const { data, error } = await api.get<{ users?: User[]; pagination?: { total?: number } }>(`/api/admin/users?${params}`);
      if (!error && data) {
        setUsers(data.users || []);
        setTotal(data.pagination?.total || 0);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const toggleStatus = async (u: User) => {
    await api.put(`/api/admin/users/${u.id}`, { accountStatus: u.accountStatus === 'active' ? 'suspended' : 'active' });
    fetchUsers();
  };

  const deleteUser = async () => {
    if (!selectedUser) return;
    await api.delete(`/api/admin/users/${selectedUser.id}`);
    setShowDeleteConfirm(false);
    setSelectedUser(null);
    fetchUsers();
  };

  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: colors.textPrimary }}>Usuarios</h1>
        <p style={{ color: colors.textMuted }}>{total} usuarios en total</p>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-72 px-4 py-2.5 pl-10 rounded-lg focus:outline-none transition-colors"
            style={{
              backgroundColor: isDark ? 'transparent' : colors.bgCard,
              border: `1px solid ${isDark ? 'rgb(55, 65, 81)' : colors.border}`,
              color: colors.textPrimary,
            }}
          />
          <svg className="absolute left-3 top-3" style={{ color: colors.textMuted }} width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </div>

        <button
          onClick={() => { setSelectedUser(null); setShowModal(true); }}
          className="px-5 py-2.5 bg-[#00D4B3] text-black font-semibold rounded-lg hover:bg-[#00b89c] transition-colors"
        >
          + Agregar
        </button>
      </div>


      {/* Users Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#00D4B3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <svg className="mx-auto mb-4 text-gray-600" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/>
          </svg>
          <p>No hay usuarios</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {users.map((user) => (
            <div
              key={user.id}
              className="group flex items-center justify-between p-5 rounded-2xl transition-all"
              style={{
                background: isDark 
                  ? 'linear-gradient(to right, rgba(17, 24, 39, 0.5), rgba(31, 41, 55, 0.3))'
                  : colors.bgCard,
                border: `1px solid ${colors.border}`,
              }}
            >
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00D4B3] to-[#00A896] flex items-center justify-center text-white font-bold text-lg">
                    {user.firstName[0]}
                  </div>
                  <div 
                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 ${
                      user.accountStatus === 'active' ? 'bg-emerald-500' : 'bg-gray-500'
                    }`}
                    style={{ borderColor: isDark ? 'rgb(17, 24, 39)' : colors.bgCard }}
                  />
                </div>

                {/* Info */}
                <div>
                  <h3 className="font-semibold" style={{ color: colors.textPrimary }}>{user.displayName}</h3>
                  <p className="text-sm" style={{ color: colors.textMuted }}>{user.email}</p>
                </div>
              </div>

              {/* Right Side */}
              <div className="flex items-center gap-6">
                {/* Role Badge */}
                <span 
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{ 
                    backgroundColor: isDark ? 'rgb(31, 41, 55)' : 'rgba(0, 0, 0, 0.05)',
                    color: colors.textSecondary 
                  }}
                >
                  {user.permissionLevel === 'super_admin' ? 'Super Admin' : 
                   user.permissionLevel === 'admin' ? 'Admin' : 
                   user.permissionLevel === 'manager' ? 'Manager' : 'Usuario'}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setSelectedUser(user); setShowModal(true); }}
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                    title="Editar"
                  >
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => toggleStatus(user)}
                    className="p-2 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-gray-800 transition-colors"
                    title={user.accountStatus === 'active' ? 'Suspender' : 'Activar'}
                  >
                    {user.accountStatus === 'active' ? (
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                    )}
                  </button>
                  {user.permissionLevel !== 'super_admin' && (
                    <button
                      onClick={() => { setSelectedUser(user); setShowDeleteConfirm(true); }}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-colors"
                      title="Eliminar"
                    >
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && users.length > 0 && (
        <div className="flex justify-center gap-2 mt-8">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-40 transition-colors"
          >
            ← Anterior
          </button>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={users.length < 10}
            className="px-4 py-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-40 transition-colors"
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* User Modal */}
      {showModal && <UserFormModal user={selectedUser} onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); fetchUsers(); }} />}

      {/* Delete Confirm */}
      {showDeleteConfirm && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold text-white mb-3">¿Eliminar usuario?</h3>
            <p className="text-gray-400 mb-6">
              Esta acción eliminará a <span className="text-white font-medium">{selectedUser.displayName}</span> permanentemente.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors">
                Cancelar
              </button>
              <button onClick={deleteUser} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Split Panel Modal - SOFIA Design System
type PermissionLevel = 'super_admin' | 'admin' | 'manager' | 'user' | 'viewer' | 'guest';

function UserFormModal({ user, onClose, onSave }: { user: User | null; onClose: () => void; onSave: () => void }) {
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;
  
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastNamePaternal: user?.lastNamePaternal || '',
    lastNameMaternal: user?.lastNameMaternal || '',
    email: user?.email || '',
    username: user?.username || '',
    password: '',
    permissionLevel: (user?.permissionLevel || 'user') as PermissionLevel,
    department: user?.department || '',
    companyRole: user?.companyRole || '',
    phoneNumber: user?.phoneNumber || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  const roleOptions = [
    { value: 'user', label: 'Usuario', desc: 'Acceso básico' },
    { value: 'viewer', label: 'Visor', desc: 'Solo lectura' },
    { value: 'manager', label: 'Manager', desc: 'Gestión de equipos' },
    { value: 'admin', label: 'Administrador', desc: 'Acceso completo' },
    { value: 'super_admin', label: 'Super Admin', desc: 'Control total' },
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const body = { ...form };
      if (!form.password && user) delete (body as Record<string, unknown>).password;
      const { error } = user
        ? await api.put(`/api/admin/users/${user.id}`, body)
        : await api.post('/api/admin/users', body);
      if (error) {
        throw new Error(error || 'Error');
      }
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
    setLoading(false);
  };

  // Preview initials
  const initials = form.firstName && form.lastNamePaternal 
    ? `${form.firstName[0]}${form.lastNamePaternal[0]}`.toUpperCase() 
    : '?';

  const selectedRole = roleOptions.find(r => r.value === form.permissionLevel);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 backdrop-blur-sm"
        style={{ backgroundColor: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.4)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div 
        className="relative rounded-2xl shadow-2xl overflow-hidden"
        style={{ 
          backgroundColor: isDark ? '#1a1f2e' : colors.bgCard, 
          border: `1px solid ${colors.border}`,
          maxWidth: '800px', 
          width: '100%' 
        }}
      >
        <div className="flex min-h-[580px]">
          
          {/* Left Panel - Preview */}
          <div 
            className="w-72 p-8 flex flex-col items-center"
            style={{ 
              background: isDark 
                ? 'linear-gradient(135deg, rgba(0, 212, 179, 0.08), rgba(10, 37, 64, 0.15))'
                : 'linear-gradient(135deg, rgba(0, 212, 179, 0.1), rgba(248, 250, 252, 1))',
              borderRight: `1px solid ${colors.border}`,
            }}
          >
            {/* Avatar */}
            <div className="relative mb-6 mt-4">
              <div 
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold"
                style={{ 
                  background: 'linear-gradient(135deg, #00D4B3, #0A2540)',
                  boxShadow: '0 8px 24px rgba(0, 212, 179, 0.25)'
                }}
              >
                {initials}
              </div>
              <div 
                className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#00D4B3' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
            </div>

            {/* Preview Info */}
            <div className="text-center mb-6">
              <h3 className="font-semibold text-lg mb-1" style={{ color: colors.textPrimary }}>
                {form.firstName || form.lastNamePaternal 
                  ? `${form.firstName} ${form.lastNamePaternal}`.trim() 
                  : 'Nuevo Usuario'}
              </h3>
              <p className="text-sm mb-3" style={{ color: colors.textMuted }}>
                {form.email || 'correo@ejemplo.com'}
              </p>
              <span 
                className="inline-flex px-3 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: 'rgba(0, 212, 179, 0.15)', color: '#00D4B3' }}
              >
                {selectedRole?.label || 'Usuario'}
              </span>
            </div>

            {/* Preview Stats */}
            <div className="w-full space-y-2 text-sm">
              <div className="flex items-center justify-between py-2" style={{ borderTop: `1px solid ${colors.border}` }}>
                <span style={{ color: colors.textMuted }}>Usuario</span>
                <span className="font-mono" style={{ color: colors.textSecondary }}>@{form.username || '...'}</span>
              </div>
              <div className="flex items-center justify-between py-2" style={{ borderTop: `1px solid ${colors.border}` }}>
                <span style={{ color: colors.textMuted }}>Cargo</span>
                <span style={{ color: colors.textSecondary }}>{form.companyRole || '—'}</span>
              </div>
              <div className="flex items-center justify-between py-2" style={{ borderTop: `1px solid ${colors.border}` }}>
                <span style={{ color: colors.textMuted }}>Departamento</span>
                <span style={{ color: colors.textSecondary }}>{form.department || '—'}</span>
              </div>
              <div className="flex items-center justify-between py-2" style={{ borderTop: `1px solid ${colors.border}` }}>
                <span style={{ color: colors.textMuted }}>Teléfono</span>
                <span style={{ color: colors.textSecondary }}>{form.phoneNumber || '—'}</span>
              </div>
            </div>
          </div>

          {/* Right Panel - Form */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${colors.border}` }}>
              <div>
                <h2 className="text-xl font-semibold" style={{ color: colors.textPrimary }}>
                  {user ? 'Editar Usuario' : 'Crear Usuario'}
                </h2>
                <p className="text-sm" style={{ color: colors.textMuted }}>
                  {user ? 'Modifica los datos del usuario' : 'Completa los datos del nuevo usuario'}
                </p>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 rounded-lg transition-colors"
                style={{ color: colors.textMuted }}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={submit} className="flex-1 flex flex-col">
              <div className="flex-1 px-6 py-4 space-y-4 overflow-y-auto max-h-[420px] scrollbar-hidden">
                {error && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                  </div>
                )}

                {/* Section: Información Personal */}
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wider" style={{ color: colors.textMuted }}>Información Personal</p>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <FormInput 
                      label="Nombre" 
                      value={form.firstName} 
                      onChange={v => setForm(f => ({ ...f, firstName: v }))} 
                      placeholder="Juan"
                      required 
                    />
                    <FormInput 
                      label="Ap. Paterno" 
                      value={form.lastNamePaternal} 
                      onChange={v => setForm(f => ({ ...f, lastNamePaternal: v }))} 
                      placeholder="Pérez"
                      required 
                    />
                    <FormInput 
                      label="Ap. Materno" 
                      value={form.lastNameMaternal} 
                      onChange={v => setForm(f => ({ ...f, lastNameMaternal: v }))} 
                      placeholder="García"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FormInput 
                      label="Correo electrónico" 
                      type="email"
                      value={form.email} 
                      onChange={v => setForm(f => ({ ...f, email: v }))} 
                      placeholder="usuario@empresa.com"
                      icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>}
                      required 
                    />
                    <FormInput 
                      label="Teléfono" 
                      value={form.phoneNumber} 
                      onChange={v => setForm(f => ({ ...f, phoneNumber: v }))} 
                      placeholder="+52 55 1234 5678"
                      icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>}
                    />
                  </div>
                </div>

                {/* Section: Cuenta */}
                <div className="space-y-3 pt-2">
                  <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Cuenta</p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <FormInput 
                      label="Usuario" 
                      value={form.username} 
                      onChange={v => setForm(f => ({ ...f, username: v }))} 
                      placeholder="juanperez"
                      prefix="@"
                      required 
                    />
                    
                    {/* Premium Dropdown for Role */}
                    <div className="relative">
                      <label className="block text-xs mb-1.5" style={{ color: colors.textMuted }}>Rol</label>
                      <button
                        type="button"
                        onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                        className="w-full px-3 py-2 rounded-xl border-2 flex items-center justify-between gap-2 transition-all duration-200"
                        style={{
                          backgroundColor: isDark ? '#0F1419' : colors.bgSecondary,
                          borderColor: roleDropdownOpen ? '#00D4B3' : colors.border,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: '#00D4B3' }}
                          />
                          <span className="text-sm" style={{ color: colors.textPrimary }}>{selectedRole?.label}</span>
                        </div>
                        <svg 
                          className={`w-4 h-4 transition-transform duration-200 ${roleDropdownOpen ? 'rotate-180' : ''}`}
                          style={{ color: colors.textMuted }}
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path d="M19 9l-7 7-7-7"/>
                        </svg>
                      </button>

                      {/* Dropdown Menu - Compact */}
                      {roleDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setRoleDropdownOpen(false)} />
                          <div 
                            className="absolute top-full left-0 right-0 mt-1 rounded-lg border overflow-hidden shadow-xl z-50"
                            style={{ 
                              backgroundColor: isDark ? '#1E2329' : colors.bgCard, 
                              borderColor: colors.border 
                            }}
                          >
                            {roleOptions.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  setForm(f => ({ ...f, permissionLevel: option.value as PermissionLevel }));
                                  setRoleDropdownOpen(false);
                                }}
                                className="w-full px-3 py-2 text-left text-sm transition-colors flex items-center justify-between"
                                style={{
                                  color: form.permissionLevel === option.value ? colors.textPrimary : colors.textSecondary,
                                  backgroundColor: form.permissionLevel === option.value 
                                    ? 'rgba(0, 212, 179, 0.15)' 
                                    : 'transparent',
                                }}
                              >
                                <span>{option.label}</span>
                                {form.permissionLevel === option.value && (
                                  <svg className="w-3.5 h-3.5 text-[#00D4B3]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path d="M5 13l4 4L19 7"/>
                                  </svg>
                                )}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <FormInput 
                    label={user ? 'Nueva contraseña (dejar vacío para mantener)' : 'Contraseña'}
                    type="password"
                    value={form.password} 
                    onChange={v => setForm(f => ({ ...f, password: v }))} 
                    placeholder="••••••••"
                    icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}
                    required={!user}
                  />
                </div>

                {/* Section: Organización */}
                <div className="space-y-3 pt-2">
                  <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Organización</p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <FormInput 
                      label="Cargo / Puesto" 
                      value={form.companyRole} 
                      onChange={v => setForm(f => ({ ...f, companyRole: v }))} 
                      placeholder="Gerente de Ventas"
                    />
                    <FormInput 
                      label="Departamento" 
                      value={form.department} 
                      onChange={v => setForm(f => ({ ...f, department: v }))} 
                      placeholder="Comercial"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/5 flex items-center justify-end gap-3">
                <button 
                  type="button" 
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ 
                    backgroundColor: '#0A2540',
                    boxShadow: '0 4px 15px rgba(10, 37, 64, 0.4)'
                  }}
                >
                  {loading ? 'Guardando...' : user ? 'Guardar cambios' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// Reusable Form Input Component
function FormInput({ 
  label, 
  value, 
  onChange, 
  type = 'text', 
  placeholder = '',
  required = false,
  icon,
  prefix,
}: { 
  label: string; 
  value: string; 
  onChange: (v: string) => void; 
  type?: string; 
  placeholder?: string;
  required?: boolean;
  icon?: React.ReactNode;
  prefix?: string;
}) {
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;

  return (
    <div>
      <label className="block text-xs mb-1.5" style={{ color: colors.textMuted }}>{label}</label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }}>
            {icon}
          </span>
        )}
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: colors.textMuted }}>
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={`w-full py-2 rounded-xl border text-sm focus:outline-none transition-colors ${
            icon ? 'pl-10 pr-3' : prefix ? 'pl-7 pr-3' : 'px-3'
          }`}
          style={{
            backgroundColor: isDark ? '#0F1419' : colors.bgSecondary,
            borderColor: colors.border,
            color: colors.textPrimary,
          }}
        />
      </div>
    </div>
  );
}
