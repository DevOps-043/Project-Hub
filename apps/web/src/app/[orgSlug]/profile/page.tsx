'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/core/stores/authStore';
import { useTheme } from '@/contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function WorkspaceProfilePage() {
  const { user, fetchCurrentUser } = useAuthStore();
  const { isDark } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    first_name: '', last_name_paternal: '', last_name_maternal: '',
    display_name: '', username: '', phone_number: '',
    company_role: '', department: '',
    timezone: 'America/Mexico_City', locale: 'es-MX', avatar_url: '',
  });

  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  useEffect(() => { loadFullProfile(); }, []);

  useEffect(() => {
    if (user && !formData.first_name) {
      setFormData(prev => ({
        ...prev,
        first_name: user.firstName || '',
        last_name_paternal: user.lastName?.split(' ')[0] || '',
        last_name_maternal: user.lastName?.split(' ').slice(1).join(' ') || '',
        display_name: user.name || '',
        company_role: user.companyRole || '',
        department: user.department || '',
        timezone: user.timezone || 'America/Mexico_City',
        avatar_url: user.avatar || '',
      }));
    }
  }, [user]);

  const loadFullProfile = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      const res = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const fullUser = await res.json();
        setFormData({
          first_name: fullUser.firstNameRaw || fullUser.firstName || '',
          last_name_paternal: fullUser.lastNamePaternal || fullUser.lastName?.split(' ')[0] || '',
          last_name_maternal: fullUser.lastNameMaternal || '',
          display_name: fullUser.name || '',
          username: fullUser.username || '',
          phone_number: fullUser.phoneNumber || '',
          company_role: fullUser.companyRole || '',
          department: fullUser.department || '',
          timezone: fullUser.timezone || 'America/Mexico_City',
          locale: fullUser.locale || 'es-MX',
          avatar_url: fullUser.avatar || '',
        });
      }
    } catch (error) { console.error('Error cargando perfil:', error); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setSuccessMessage(null); setErrorMessage(null);
    try {
      const token = localStorage.getItem('accessToken');
      const { avatar_url, ...dataToSend } = formData;
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(dataToSend)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar perfil');
      setSuccessMessage('Perfil actualizado correctamente');
      await fetchCurrentUser();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) { setErrorMessage(err.message); }
    finally { setLoading(false); }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangingPassword(true); setSuccessMessage(null); setErrorMessage(null);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(passwordData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cambiar contrasena');
      setSuccessMessage('Contrasena actualizada correctamente');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordSection(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) { setErrorMessage(err.message); }
    finally { setChangingPassword(false); }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) { setErrorMessage('Tipo de archivo no permitido. Usa: JPG, PNG, GIF o WebP'); return; }
    if (file.size > 5 * 1024 * 1024) { setErrorMessage('El archivo es demasiado grande. Maximo 5MB'); return; }
    setUploadingAvatar(true); setErrorMessage(null);
    try {
      const token = localStorage.getItem('accessToken');
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      const res = await fetch('/api/upload/avatar', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formDataUpload });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al subir la imagen');
      setFormData(prev => ({ ...prev, avatar_url: data.avatarUrl }));
      setSuccessMessage('Imagen de perfil actualizada');
      await fetchCurrentUser();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) { setErrorMessage(err.message); }
    finally { setUploadingAvatar(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleRemoveAvatar = async () => {
    if (!formData.avatar_url) return;
    if (!confirm('Estas seguro de que quieres eliminar tu foto de perfil?')) return;
    setUploadingAvatar(true); setErrorMessage(null);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/upload/avatar', { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar la imagen');
      setFormData(prev => ({ ...prev, avatar_url: '' }));
      setSuccessMessage('Imagen de perfil eliminada');
      await fetchCurrentUser();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) { setErrorMessage(err.message); }
    finally { setUploadingAvatar(false); }
  };

  const inputClass = `w-full px-4 py-2.5 rounded-lg border text-sm transition-all outline-none focus:ring-2
    ${isDark ? 'bg-[#1E2329] border-white/10 text-white focus:border-emerald-500/50 focus:ring-emerald-500/20' : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'}`;
  const labelClass = `block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`;
  const cardClass = `p-6 rounded-xl border ${isDark ? 'bg-[#0F1419] border-white/5' : 'bg-white border-gray-100 shadow-sm'}`;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Configuracion de Perfil</h1>
        <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Gestiona tu informacion personal y preferencias de la cuenta.</p>
      </div>

      <AnimatePresence>
        {successMessage && (<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm">{successMessage}</motion.div>)}
        {errorMessage && (<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">{errorMessage}</motion.div>)}
      </AnimatePresence>

      {/* Avatar Section */}
      <div className={cardClass}>
        <h2 className={`text-lg font-semibold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Imagen de Perfil</h2>
        <div className="flex items-center gap-6">
          <div className="relative group">
            <div className={`w-28 h-28 rounded-full flex items-center justify-center overflow-hidden border-2 transition-all ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'} ${uploadingAvatar ? 'opacity-50' : ''}`}>
              {formData.avatar_url ? (<img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />) : (<span className={`text-3xl font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{formData.first_name?.[0]}{formData.last_name_paternal?.[0]}</span>)}
              {uploadingAvatar && (<div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full"><div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div></div>)}
            </div>
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <p className={`text-sm font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Actualiza tu foto de perfil</p>
              <p className={`text-xs mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>JPG, PNG, GIF o WebP. Maximo 5MB.</p>
              <div className="flex gap-3">
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleFileSelect} className="hidden" disabled={uploadingAvatar} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${uploadingAvatar ? 'bg-gray-500/50 cursor-not-allowed text-gray-300' : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white'}`}>{uploadingAvatar ? 'Subiendo...' : 'Subir imagen'}</button>
                {formData.avatar_url && (<button type="button" onClick={handleRemoveAvatar} disabled={uploadingAvatar} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${isDark ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-red-200 text-red-600 hover:bg-red-50'} ${uploadingAvatar ? 'opacity-50 cursor-not-allowed' : ''}`}>Eliminar</button>)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className={cardClass}>
          <h2 className={`text-lg font-semibold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Informacion de Cuenta</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label className={labelClass}>Nombre de usuario</label><input type="text" name="username" value={formData.username} onChange={handleChange} pattern="^[A-Za-z0-9_-]{3,50}$" title="3-50 caracteres" className={inputClass} /><p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>3-50 caracteres. Solo letras, numeros, - y _</p></div>
            <div><label className={labelClass}>Email (Solo lectura)</label><input type="email" value={user?.email || ''} readOnly disabled className={`${inputClass} opacity-60 cursor-not-allowed`} /></div>
          </div>
        </div>

        <div className={cardClass}>
          <h2 className={`text-lg font-semibold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Informacion Personal</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label className={labelClass}>Nombre *</label><input type="text" name="first_name" value={formData.first_name} onChange={handleChange} required className={inputClass} /></div>
            <div><label className={labelClass}>Apellido Paterno *</label><input type="text" name="last_name_paternal" value={formData.last_name_paternal} onChange={handleChange} required className={inputClass} /></div>
            <div><label className={labelClass}>Apellido Materno</label><input type="text" name="last_name_maternal" value={formData.last_name_maternal} onChange={handleChange} className={inputClass} /></div>
            <div><label className={labelClass}>Nombre para mostrar</label><input type="text" name="display_name" value={formData.display_name} onChange={handleChange} className={inputClass} placeholder={user?.email?.split('@')[0]} /></div>
          </div>
        </div>

        <div className={cardClass}>
          <h2 className={`text-lg font-semibold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Informacion Profesional y Contacto</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label className={labelClass}>Cargo / Rol</label><input type="text" name="company_role" value={formData.company_role} onChange={handleChange} placeholder="Ej. Desarrollador Senior" className={inputClass} /></div>
            <div><label className={labelClass}>Departamento</label><input type="text" name="department" value={formData.department} onChange={handleChange} placeholder="Ej. Ingenieria" className={inputClass} /></div>
            <div><label className={labelClass}>Telefono</label><input type="tel" name="phone_number" value={formData.phone_number} onChange={handleChange} className={inputClass} /></div>
          </div>
        </div>

        <div className={cardClass}>
          <h2 className={`text-lg font-semibold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Preferencias Regionales</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label className={labelClass}>Zona Horaria</label><select name="timezone" value={formData.timezone} onChange={handleChange} className={`${inputClass} appearance-none cursor-pointer`}><option value="America/Mexico_City">Ciudad de Mexico (GMT-6)</option><option value="America/Bogota">Bogota (GMT-5)</option><option value="America/Lima">Lima (GMT-5)</option><option value="America/Santiago">Santiago (GMT-4)</option><option value="America/Argentina/Buenos_Aires">Buenos Aires (GMT-3)</option><option value="Europe/Madrid">Madrid (GMT+1)</option><option value="US/Eastern">US Eastern (GMT-5)</option><option value="US/Pacific">US Pacific (GMT-8)</option><option value="UTC">UTC (GMT+0)</option></select></div>
            <div><label className={labelClass}>Idioma</label><select name="locale" value={formData.locale} onChange={handleChange} className={`${inputClass} appearance-none cursor-pointer`}><option value="es-MX">Espanol (Mexico)</option><option value="es-ES">Espanol (Espana)</option><option value="en-US">English (US)</option><option value="pt-BR">Portugues (Brasil)</option></select></div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button type="submit" disabled={loading} className={`px-8 py-3 rounded-lg font-medium text-sm transition-all ${loading ? 'bg-gray-500/50 cursor-not-allowed text-gray-300' : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/20'}`}>{loading ? 'Guardando...' : 'Guardar Cambios'}</button>
        </div>
      </form>

      <div className={cardClass}>
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Seguridad</h2>
          {!showPasswordSection && (<button type="button" onClick={() => setShowPasswordSection(true)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${isDark ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>Cambiar Contrasena</button>)}
        </div>
        <AnimatePresence>
          {showPasswordSection && (
            <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} onSubmit={handlePasswordSubmit} className="space-y-4">
              <div><label className={labelClass}>Contrasena actual</label><input type="password" name="currentPassword" value={passwordData.currentPassword} onChange={handlePasswordChange} required className={inputClass} /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className={labelClass}>Nueva contrasena</label><input type="password" name="newPassword" value={passwordData.newPassword} onChange={handlePasswordChange} required minLength={8} className={inputClass} /></div>
                <div><label className={labelClass}>Confirmar nueva contrasena</label><input type="password" name="confirmPassword" value={passwordData.confirmPassword} onChange={handlePasswordChange} required className={inputClass} /></div>
              </div>
              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>La contrasena debe tener al menos 8 caracteres, incluir mayusculas, minusculas y numeros.</p>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={changingPassword} className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${changingPassword ? 'bg-gray-500/50 cursor-not-allowed text-gray-300' : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white'}`}>{changingPassword ? 'Actualizando...' : 'Actualizar Contrasena'}</button>
                <button type="button" onClick={() => { setShowPasswordSection(false); setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' }); }} className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all border ${isDark ? 'border-white/10 text-gray-400 hover:bg-white/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Cancelar</button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
        {!showPasswordSection && (<p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Te recomendamos usar una contrasena segura que no uses en otros sitios.</p>)}
      </div>
    </div>
  );
}
