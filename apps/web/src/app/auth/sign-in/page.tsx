'use client';

import { useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/core/stores/authStore';

export default function SignInPage() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const logoControls = useAnimationControls();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();
    
    try {
      await login({ email, password });
      
      // Obtener usuario actualizado para decidir redirección
      const user = useAuthStore.getState().user;
      
      // Verificar si hay una URL de retorno
      const searchParams = new URLSearchParams(window.location.search);
      const returnUrl = searchParams.get('returnUrl');

      if (returnUrl) {
        router.push(returnUrl);
      } else if (user?.role === 'admin' || user?.permissionLevel === 'admin' || user?.permissionLevel === 'super_admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al iniciar sesión';
      setLocalError(errorMessage);
    }
  };

  const handleLogoHover = () => {
    const newRotation = rotation + 720; // Suma 2 vueltas cada vez
    setRotation(newRotation);
    logoControls.start({
      rotate: newRotation,
      transition: { 
        duration: 1.5, 
        ease: [0.4, 0, 0.2, 1] // Suave con desaceleración al final
      }
    });
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-12 relative z-10">
      {/* Patrón de fondo sutil */}
      {/* Patrón de fondo sutil */}
      <div 
        className="fixed inset-0 opacity-[0.02] dark:opacity-[0.05] pointer-events-none text-[#0A2540] dark:text-gray-600"
        style={{
          backgroundImage: `linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Contenedor principal - dos columnas */}
      <div className="relative w-full max-w-6xl flex flex-col lg:flex-row items-center justify-between gap-6 sm:gap-10 lg:gap-20">
        
        {/* Lado Izquierdo - Logo Flotante */}
        <div className="hidden md:flex flex-1 items-center justify-center">
          <motion.div
            className="relative cursor-pointer"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              y: [0, -15, 0] 
            }}
            transition={{ 
              opacity: { duration: 0.5 },
              scale: { duration: 0.5 },
              y: { duration: 5, repeat: Infinity, ease: "easeInOut" }
            }}
          >
            <motion.div
              animate={logoControls}
              onMouseEnter={handleLogoHover}
            >
              <Image
                src="/Logo.png"
                alt="IRIS Logo"
                width={320}
                height={320}
                className="w-48 h-48 md:w-64 md:h-64 lg:w-80 lg:h-80 object-contain"
                style={{ filter: 'drop-shadow(0 25px 50px rgba(10, 37, 64, 0.15))' }}
                priority
              />
            </motion.div>
          </motion.div>
        </div>

        {/* Lado Derecho - Card de Login Flotante */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="w-full max-w-[520px] bg-white dark:bg-[#1E2329] rounded-2xl shadow-xl p-6 sm:p-10 lg:p-14 border border-transparent dark:border-white/10"
          style={{ 
            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1), 0 0 1px rgba(0,0,0,0.1)' 
          }}
        >
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl lg:text-4xl font-bold text-[#0A2540] dark:text-white mb-3">
              Bienvenido de nuevo
            </h1>
            <p className="text-[#6B7280] dark:text-gray-400 text-base">
              Gestiona tus flujos de trabajo y proyectos
            </p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Mensaje de error */}
            {(localError || error) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200"
              >
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">{localError || error}</p>
              </motion.div>
            )}
            {/* Campo Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#0A2540] dark:text-gray-200 mb-1.5">
                Correo o Usuario
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#9CA3AF]" />
                <input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com o usuario123"
                  className="w-full pl-11 pr-4 py-3 rounded-lg border border-[#E5E7EB] dark:border-gray-700 bg-white dark:bg-[#0F1419] text-[#0A2540] dark:text-white placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0A2540]/10 dark:focus:ring-[#00D4B3]/20 focus:border-[#0A2540] dark:focus:border-[#00D4B3] transition-all text-sm"
                  required
                />
              </div>
            </div>

            {/* Campo Contraseña */}
            <div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#9CA3AF]" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-11 py-3 rounded-lg border border-[#E5E7EB] dark:border-gray-700 bg-white dark:bg-[#0F1419] text-[#0A2540] dark:text-white placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0A2540]/10 dark:focus:ring-[#00D4B3]/20 focus:border-[#0A2540] dark:focus:border-[#00D4B3] transition-all text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] dark:hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            {/* Recordarme y Olvidé contraseña */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div 
                  className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-all ${
                    rememberMe 
                      ? 'border-[#0A2540] bg-[#0A2540] dark:border-[#00D4B3] dark:bg-[#00D4B3]' 
                      : 'border-[#D1D5DB] dark:border-gray-600 group-hover:border-[#9CA3AF] dark:group-hover:border-gray-400'
                  }`}
                  onClick={() => setRememberMe(!rememberMe)}
                >
                  {rememberMe && (
                    <motion.div 
                      className="w-1.5 h-1.5 rounded-full bg-white dark:bg-[#0A0D12]"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    />
                  )}
                </div>
                <span className="text-sm text-[#6B7280] dark:text-gray-400">Recordarme</span>
              </label>
              <Link 
                href="/auth/forgot-password"
                className="text-sm text-[#00D4B3] hover:text-[#00b89c] transition-colors font-medium"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            {/* Botón Iniciar Sesión */}
            <motion.button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-6 rounded-lg bg-[#0A2540] text-white font-medium flex items-center justify-center gap-2 hover:bg-[#122d4a] active:scale-[0.99] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              whileTap={{ scale: 0.99 }}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ArrowRight className="w-[18px] h-[18px]" />
                  <span>Iniciar sesión</span>
                </>
              )}
            </motion.button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
