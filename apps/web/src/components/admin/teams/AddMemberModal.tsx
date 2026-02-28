'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, themeColors } from '@/contexts/ThemeContext';

interface User {
  id: string; // user_id
  display_name?: string;
  email: string;
  avatar_url?: string;
  first_name?: string;
  last_name_paternal?: string;
}

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  teamId: string;
  teamName?: string;
}

const ROLES = [
  { value: 'member', label: 'Miembro', description: 'Puede ver y editar tareas asignadas.' },
  { value: 'admin', label: 'Admin', description: 'Control total sobre el equipo y proyectos.' },
  { value: 'viewer', label: 'Observador', description: 'Solo lectura.' },
];

export function AddMemberModal({ isOpen, onClose, onSuccess, teamId, teamName }: AddMemberModalProps) {
  const { isDark } = useTheme();
  // Usaremos los colores del sistema SOFIA hardcodeados por ahora para asegurar match con la guía
  // En un caso real vendrían del contexto de organización
  const primaryColor = '#0A2540';
  const accentColor = '#00D4B3';
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState('member');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch users for search
  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        const userList = data.users || [];
        // Mapear si es necesario para ajustar al tipo User
        setUsers(userList.map((u: any) => ({
            id: u.user_id || u.id,
            display_name: u.display_name,
            email: u.email,
            avatar_url: u.avatar_url,
            first_name: u.first_name,
            last_name_paternal: u.last_name_paternal
        })));
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      // Fallback a array vacío
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
      const searchLower = searchQuery.toLowerCase();
      const name = (user.display_name || user.first_name || '').toLowerCase();
      const email = user.email.toLowerCase();
      return name.includes(searchLower) || email.includes(searchLower);
  }).slice(0, 5); // Limitar a 5 resultados para no saturar

  const handleSubmit = async () => {
    if (!selectedUser) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUser.id,
          role: selectedRole
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al añadir miembro');
      }

      onSuccess?.();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSelectedUser(null);
    setSelectedRole('member');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 flex items-center justify-center"
        style={{ zIndex: 99999 }}
      >
        {/* Backdrop transparent/blur per docs */}
        <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           className="absolute inset-0 backdrop-blur-sm"
           style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
           onClick={handleClose}
        />

        {/* Modal Box - Split Panel Pattern */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-4xl overflow-hidden rounded-2xl shadow-2xl border flex flex-col md:flex-row min-h-[500px]"
          style={{ 
            backgroundColor: isDark ? '#1E2329' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          
          {/* LEFT PANEL (Preview) - 320px fixed width */}
          <div 
            className="hidden md:flex flex-col w-80 p-8 border-r relative overflow-hidden"
            style={{ 
              background: isDark 
                ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.08))'
                : 'linear-gradient(135deg, rgba(0, 0, 0, 0.02), rgba(0, 0, 0, 0.05))',
              borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
            }}
          >
             <div className="relative z-10 flex flex-col h-full items-center justify-center text-center">
                
                {/* Avatar Preview */}
                <motion.div
                    key={selectedUser ? selectedUser.id : 'empty'}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative mb-6"
                >
                    <div 
                        className="w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-bold shadow-xl"
                        style={{ 
                            background: selectedUser 
                                ? `linear-gradient(135deg, ${primaryColor}, ${accentColor})` 
                                : 'rgba(255,255,255,0.1)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.2)'
                        }}
                    >
                        {selectedUser ? (
                            selectedUser.avatar_url ? (
                                <img src={selectedUser.avatar_url} alt="" className="w-full h-full object-cover rounded-2xl" />
                            ) : (
                                (selectedUser.first_name?.[0] || selectedUser.email[0]).toUpperCase()
                            )
                        ) : (
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-50">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                            </svg>
                        )}
                    </div>
                    {selectedUser && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-lg"
                            style={{ backgroundColor: accentColor }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                        </motion.div>
                    )}
                </motion.div>

                <h3 className="text-xl font-bold mb-2" style={{ color: isDark ? 'white' : '#111827' }}>
                    {selectedUser ? (selectedUser.display_name || selectedUser.first_name || 'Usuario') : 'Nuevo Miembro'}
                </h3>
                
                <p className="text-sm mb-6 max-w-[200px]" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : '#6B7280' }}>
                    {selectedUser 
                        ? (selectedUser.email) 
                        : 'Selecciona un usuario de la lista para añadirlo al equipo.'}
                </p>

                {selectedUser && (
                     <div className="px-3 py-1.5 rounded-full text-xs font-medium border" style={{ 
                        backgroundColor: `${primaryColor}10`,
                        color: primaryColor,
                        borderColor: `${primaryColor}20`
                     }}>
                        {ROLES.find(r => r.value === selectedRole)?.label || selectedRole}
                     </div>
                )}
             </div>

             {/* Background Decoration */}
             <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
             <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
          </div>

          {/* RIGHT PANEL (Form) - Flex 1 */}
          <div className="flex-1 flex flex-col h-full bg-inherit">
            
            {/* Header */}
            <div className="px-8 py-6 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold" style={{ color: isDark ? 'white' : '#111827' }}>Añadir al Equipo</h2>
                        <p className="text-sm mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#6B7280' }}>
                            {teamName ? `Añadiendo a: ${teamName}` : 'Busca un usuario y asígnale un rol.'}
                        </p>
                    </div>
                    <button 
                        onClick={handleClose}
                        className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                        style={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#9CA3AF' }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-8 overflow-y-auto">
                
                {/* Step 1: Search User */}
                <div className="mb-8">
                    <label className="block text-sm font-medium mb-2" style={{ color: isDark ? 'white' : '#374151' }}>
                        Buscar Usuario
                    </label>
                    <div className="relative">
                        <svg 
                            width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" 
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50"
                            style={{ color: isDark ? 'white' : 'black' }}
                        >
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar por nombre o correo..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                if (!e.target.value) { setSelectedUser(null); }
                            }}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border outline-none transition-all placeholder:opacity-50"
                            style={{ 
                                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'white',
                                borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
                                color: isDark ? 'white' : 'black'
                            }}
                        />
                    </div>

                    {/* Search Results */}
                    {searchQuery && !selectedUser && (
                        <div className="mt-2 rounded-xl border overflow-hidden" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' }}>
                            {loading ? (
                                <div className="p-4 text-center text-sm opacity-50">Buscando...</div>
                            ) : filteredUsers.length > 0 ? (
                                filteredUsers.map(user => (
                                    <button
                                        key={user.id}
                                        onClick={() => { setSelectedUser(user); setSearchQuery(''); }}
                                        className="w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-white/5"
                                    >
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-500/20 text-xs font-bold">
                                            {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full rounded-full" /> : (user.first_name?.[0] || 'U')}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium" style={{ color: isDark ? 'white' : '#111827' }}>
                                                {user.display_name || `${user.first_name} ${user.last_name_paternal}`}
                                            </div>
                                            <div className="text-xs opacity-50" style={{ color: isDark ? 'white' : '#6B7280' }}>
                                                {user.email}
                                            </div>
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <div className="p-4 text-center text-sm opacity-50">No se encontraron usuarios</div>
                            )}
                        </div>
                    )}
                </div>

                {/* Selected User Display (if picked from list, overrides search) */}
                {selectedUser && (
                    <div className="mb-8 p-3 rounded-xl flex items-center gap-3 border" style={{ borderColor: `${accentColor}40`, backgroundColor: `${accentColor}10` }}>
                         <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10 text-sm font-bold">
                            {selectedUser.avatar_url ? <img src={selectedUser.avatar_url} className="w-full h-full rounded-full" /> : (selectedUser.first_name?.[0] || 'U')}
                        </div>
                        <div className="flex-1">
                            <div className="text-sm font-bold" style={{ color: isDark ? 'white' : '#111827' }}>
                                {selectedUser.display_name || `${selectedUser.first_name} ${selectedUser.last_name_paternal}`}
                            </div>
                            <div className="text-xs opacity-70" style={{ color: isDark ? 'white' : '#6B7280' }}>
                                {selectedUser.email}
                            </div>
                        </div>
                        <button 
                            onClick={() => setSelectedUser(null)}
                            className="p-1 hover:text-red-500 transition-colors"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                    </div>
                )}

                {/* Step 2: Role Selection */}
                <div className="mb-6">
                    <label className="block text-sm font-medium mb-3" style={{ color: isDark ? 'white' : '#374151' }}>
                        Rol en el Equipo
                    </label>
                    <div className="space-y-2">
                        {ROLES.map(role => (
                            <button
                                key={role.value}
                                onClick={() => setSelectedRole(role.value)}
                                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left group ${
                                    selectedRole === role.value ? 'ring-2 ring-primary border-transparent' : 'hover:border-primary/50'
                                }`}
                                style={{ 
                                    borderColor: selectedRole === role.value ? accentColor : (isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB'),
                                    backgroundColor: selectedRole === role.value ? `${accentColor}05` : 'transparent'
                                }}
                            >
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedRole === role.value ? 'border-primary' : 'border-gray-400 group-hover:border-gray-300'}`} style={{ borderColor: selectedRole === role.value ? accentColor : undefined }}>
                                    {selectedRole === role.value && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accentColor }} />}
                                </div>
                                <div>
                                    <div className="text-sm font-semibold" style={{ color: isDark ? 'white' : '#111827' }}>{role.label}</div>
                                    <div className="text-xs opacity-60 mt-0.5" style={{ color: isDark ? 'white' : '#6B7280' }}>{role.description}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {error && (
                    <div className="p-3 rounded-xl text-sm mb-4 bg-red-500/10 text-red-500 border border-red-500/20">
                        {error}
                    </div>
                )}

            </div>

            {/* Footer */}
            <div className="px-8 py-6 border-t flex justify-end gap-3" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                <button
                    onClick={handleClose}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-white/5"
                    style={{ color: isDark ? 'rgba(255,255,255,0.7)' : '#6B7280' }}
                >
                    Cancelar
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={!selectedUser || submitting}
                    className="px-6 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                     style={{ 
                        background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
                        boxShadow: `0 4px 15px ${primaryColor}40`
                     }}
                >
                    {submitting ? 'Añadiendo...' : 'Añadir Miembro'}
                </button>
            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
