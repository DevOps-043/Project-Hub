'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/core/stores/authStore';
import { useTheme } from '@/contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useGoogleConnection } from '@/shared/hooks/useGoogleConnection';

async function readApiJson(response: Response): Promise<any> {
  const text = await response.text().catch(() => '');
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: response.ok
        ? 'Respuesta inesperada del servidor'
        : 'Respuesta no valida del servidor. Intenta nuevamente o revisa el tamano del archivo.',
    };
  }
}

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

  const google = useGoogleConnection();
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);

  const handleGoogleDisconnect = async () => {
    if (!confirm('¿Estás seguro de que deseas desconectar tu cuenta de Google? Los documentos vinculados a tus proyectos seguirán visibles, pero no podrás leer su contenido ni usar SofLIA.')) return;
    setDisconnectingGoogle(true);
    try {
      await google.disconnect();
      setSuccessMessage('Cuenta de Google desconectada exitosamente');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setErrorMessage('Error al desconectar Google');
    } finally {
      setDisconnectingGoogle(false);
    }
  };

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

  const getPasswordValidationError = () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      return 'Completa todos los campos de contrasena.';
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      return 'La confirmacion no coincide con la nueva contrasena.';
    }
    if (passwordData.newPassword.length < 8) {
      return 'La nueva contrasena debe tener al menos 8 caracteres.';
    }
    if (!/[A-Z]/.test(passwordData.newPassword) || !/[a-z]/.test(passwordData.newPassword) || !/[0-9]/.test(passwordData.newPassword)) {
      return 'La nueva contrasena debe incluir mayusculas, minusculas y numeros.';
    }
    if (passwordData.currentPassword === passwordData.newPassword) {
      return 'La nueva contrasena debe ser diferente a la actual.';
    }
    return null;
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
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || 'Error al actualizar perfil');
      setSuccessMessage('Perfil actualizado correctamente');
      await fetchCurrentUser();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) { setErrorMessage(err.message); }
    finally { setLoading(false); }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null); setErrorMessage(null);
    const validationError = getPasswordValidationError();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }
    setChangingPassword(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(passwordData)
      });
      const data = await readApiJson(res);
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
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage('Tipo de archivo no permitido. Usa: JPG, PNG, GIF o WebP');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('El archivo es demasiado grande. Maximo 5MB');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setUploadingAvatar(true); setErrorMessage(null);
    try {
      const token = localStorage.getItem('accessToken');
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      const res = await fetch('/api/upload/avatar', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formDataUpload });
      const data = await readApiJson(res);
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
      const data = await readApiJson(res);
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
              {formData.avatar_url ? (<img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />) : (<span className={`text-3xl font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{formData.first_name?.[0]}{formData.last_name_paternal?.[0]}</span>)}
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

      {/* Cuentas Conectadas */}
      <div className={cardClass}>
        <h2 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Cuentas Conectadas</h2>
        <p className={`text-sm mb-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Gestiona las integraciones externas vinculadas a tu cuenta.</p>

        {/* Google Account Card */}
        <div className={`rounded-xl border p-5 transition-all ${isDark ? 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]' : 'border-gray-100 bg-gray-50/50 hover:bg-gray-50'}`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {/* Google Logo */}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-white/5' : 'bg-white shadow-sm border border-gray-100'}`}>
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Google</span>
                  {google.isLoading ? (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${isDark ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-400'}`}>Verificando...</span>
                  ) : google.isConnected ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 font-medium">Conectada</span>
                  ) : (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${isDark ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-400'} font-medium`}>Sin conectar</span>
                  )}
                </div>
                {google.isConnected && google.googleEmail ? (
                  <div className="flex items-center gap-2">
                    {google.avatarUrl && (
                      <img src={google.avatarUrl} alt="" className="w-4 h-4 rounded-full" />
                    )}
                    <span className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{google.googleEmail}</span>
                  </div>
                ) : (
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Drive, Docs, Sheets &middot; Necesario para documentos y SofLIA</p>
                )}
              </div>
            </div>

            <div className="flex-shrink-0">
              {google.isLoading ? (
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                  <div className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" />
                </div>
              ) : google.isConnected ? (
                <button
                  onClick={handleGoogleDisconnect}
                  disabled={disconnectingGoogle}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-all border ${
                    disconnectingGoogle
                      ? 'opacity-50 cursor-not-allowed'
                      : isDark
                        ? 'border-red-500/20 text-red-400 hover:bg-red-500/10'
                        : 'border-red-200 text-red-600 hover:bg-red-50'
                  }`}
                >
                  {disconnectingGoogle ? 'Desconectando...' : 'Desconectar'}
                </button>
              ) : (
                <button
                  onClick={() => google.connect()}
                  className="px-4 py-2 rounded-lg text-xs font-medium transition-all bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-sm"
                >
                  Conectar
                </button>
              )}
            </div>
          </div>

          {/* Scopes details - solo cuando conectado */}
          <AnimatePresence>
            {google.isConnected && google.scopes && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className={`mt-4 pt-4 border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                  <p className={`text-[10px] font-medium mb-2 uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Permisos otorgados</p>
                  <div className="flex flex-wrap gap-1.5">
                    {google.scopes.map((scope, i) => {
                      const scopeName = scope.split('/').pop()?.replace('auth.', '') || scope;
                      const shortLabels: Record<string, string> = {
                        'drive.file': 'Drive (archivos)',
                        'drive.readonly': 'Drive (lectura)',
                        'spreadsheets': 'Sheets',
                        'userinfo.email': 'Email',
                        'userinfo.profile': 'Perfil',
                      };
                      return (
                        <span
                          key={i}
                          className={`text-[10px] px-2 py-1 rounded-md ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'}`}
                        >
                          {shortLabels[scopeName] || scopeName}
                        </span>
                      );
                    })}
                  </div>
                  {!google.scopes.some(s => s.includes('drive.readonly')) && (
                    <div className={`mt-3 p-2.5 rounded-lg text-[11px] font-medium ${isDark ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                      ⚠️ Tu conexión no incluye acceso de lectura. Reconecta para habilitar SofLIA.
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

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
