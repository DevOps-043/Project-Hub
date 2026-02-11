'use client';

import { useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, User, ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function SignUpPage() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rotation, setRotation] = useState(0);
  const logoControls = useAnimationControls();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptTerms) return;
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log(formData);
    setIsLoading(false);
  };

  const handleLogoHover = () => {
    const newRotation = rotation + 720;
    setRotation(newRotation);
    logoControls.start({
      rotate: newRotation,
      transition: { duration: 1.5, ease: [0.4, 0, 0.2, 1] }
    });
  };

  const passwordChecks = {
    length: formData.password.length >= 8,
    uppercase: /[A-Z]/.test(formData.password),
    number: /[0-9]/.test(formData.password),
    match: formData.password === formData.confirmPassword && formData.confirmPassword.length > 0,
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-12 relative z-10">
      <div className="fixed inset-0 opacity-[0.02] dark:opacity-[0.05] pointer-events-none text-[#0A2540] dark:text-gray-600"
        style={{ backgroundImage: `linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)`, backgroundSize: '40px 40px' }}
      />

      <div className="relative w-full max-w-6xl flex flex-col lg:flex-row items-center justify-between gap-6 sm:gap-10 lg:gap-20">
        {/* Logo */}
        <div className="hidden md:flex flex-1 items-center justify-center">
          <motion.div className="relative cursor-pointer"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1, y: [0, -15, 0] }}
            transition={{ opacity: { duration: 0.5 }, scale: { duration: 0.5 }, y: { duration: 5, repeat: Infinity, ease: "easeInOut" } }}
          >
            <motion.div animate={logoControls} onMouseEnter={handleLogoHover}>
              <Image src="/Logo.png" alt="IRIS Logo" width={320} height={320}
                className="w-48 h-48 md:w-64 md:h-64 lg:w-80 lg:h-80 object-contain"
                style={{ filter: 'drop-shadow(0 25px 50px rgba(10, 37, 64, 0.15))' }} priority />
            </motion.div>
          </motion.div>
        </div>

        {/* Card */}
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="w-full max-w-[480px] bg-white dark:bg-[#1E2329] rounded-2xl shadow-xl p-6 sm:p-8 lg:p-12 border border-transparent dark:border-white/10"
          style={{ boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1), 0 0 1px rgba(0,0,0,0.1)' }}
        >
          <div className="text-center mb-6">
            <h1 className="text-2xl lg:text-3xl font-bold text-[#0A2540] dark:text-white mb-2">Crea tu cuenta</h1>
            <p className="text-[#6B7280] dark:text-gray-400 text-sm">Comienza tu viaje de aprendizaje hoy</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-[#0A2540] dark:text-gray-200 mb-1.5">Nombre completo</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#9CA3AF]" />
                <input id="name" name="name" type="text" value={formData.name} onChange={handleChange} placeholder="Juan Pérez"
                  className="w-full pl-11 pr-4 py-3 rounded-lg border border-[#E5E7EB] dark:border-gray-700 bg-white dark:bg-[#0F1419] text-[#0A2540] dark:text-white placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0A2540]/10 dark:focus:ring-[#00D4B3]/20 focus:border-[#0A2540] dark:focus:border-[#00D4B3] transition-all text-sm" required />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#0A2540] dark:text-gray-200 mb-1.5">Correo electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#9CA3AF]" />
                <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="tu@correo.com"
                  className="w-full pl-11 pr-4 py-3 rounded-lg border border-[#E5E7EB] dark:border-gray-700 bg-white dark:bg-[#0F1419] text-[#0A2540] dark:text-white placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0A2540]/10 dark:focus:ring-[#00D4B3]/20 focus:border-[#0A2540] dark:focus:border-[#00D4B3] transition-all text-sm" required />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#0A2540] dark:text-gray-200 mb-1.5">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#9CA3AF]" />
                <input id="password" name="password" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={handleChange} placeholder="••••••••"
                  className="w-full pl-11 pr-11 py-3 rounded-lg border border-[#E5E7EB] dark:border-gray-700 bg-white dark:bg-[#0F1419] text-[#0A2540] dark:text-white placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0A2540]/10 dark:focus:ring-[#00D4B3]/20 focus:border-[#0A2540] dark:focus:border-[#00D4B3] transition-all text-sm" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] dark:hover:text-gray-300 transition-colors">
                  {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
              {formData.password && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  <span className={`flex items-center gap-1 text-xs ${passwordChecks.length ? 'text-[#10B981]' : 'text-[#9CA3AF]'}`}><Check className="w-3 h-3" /> 8+ caracteres</span>
                  <span className={`flex items-center gap-1 text-xs ${passwordChecks.uppercase ? 'text-[#10B981]' : 'text-[#9CA3AF]'}`}><Check className="w-3 h-3" /> Mayúscula</span>
                  <span className={`flex items-center gap-1 text-xs ${passwordChecks.number ? 'text-[#10B981]' : 'text-[#9CA3AF]'}`}><Check className="w-3 h-3" /> Número</span>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#0A2540] dark:text-gray-200 mb-1.5">Confirmar contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#9CA3AF]" />
                <input id="confirmPassword" name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={formData.confirmPassword} onChange={handleChange} placeholder="••••••••"
                  className={`w-full pl-11 pr-11 py-3 rounded-lg border bg-white dark:bg-[#0F1419] text-[#0A2540] dark:text-white placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0A2540]/10 dark:focus:ring-[#00D4B3]/20 transition-all text-sm ${formData.confirmPassword && !passwordChecks.match ? 'border-[#EF4444]' : 'border-[#E5E7EB] dark:border-gray-700 focus:border-[#0A2540] dark:focus:border-[#00D4B3]'}`} required />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] dark:hover:text-gray-300 transition-colors">
                  {showConfirmPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
              {formData.confirmPassword && !passwordChecks.match && <p className="text-xs text-[#EF4444] mt-1">Las contraseñas no coinciden</p>}
            </div>

            <div className="flex items-start gap-2.5">
              <div className={`w-[18px] h-[18px] mt-0.5 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${acceptTerms ? 'border-[#0A2540] bg-[#0A2540] dark:border-[#00D4B3] dark:bg-[#00D4B3]' : 'border-[#D1D5DB] dark:border-gray-600 hover:border-[#9CA3AF] dark:hover:border-gray-400'}`}
                onClick={() => setAcceptTerms(!acceptTerms)}>
                {acceptTerms && <Check className="w-3 h-3 text-white dark:text-[#0A0D12]" />}
              </div>
              <span className="text-xs text-[#6B7280] dark:text-gray-400">
                Acepto los <Link href="/terms" className="text-[#00D4B3] hover:underline">términos de servicio</Link> y la <Link href="/privacy" className="text-[#00D4B3] hover:underline">política de privacidad</Link>
              </span>
            </div>

            <motion.button type="submit" disabled={isLoading || !acceptTerms}
              className="w-full py-3 px-6 rounded-lg bg-[#0A2540] text-white font-medium flex items-center justify-center gap-2 hover:bg-[#122d4a] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              whileTap={{ scale: 0.99 }}>
              {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><ArrowRight className="w-[18px] h-[18px]" /><span>Crear cuenta</span></>}
            </motion.button>

            <p className="text-center text-sm text-[#6B7280] dark:text-gray-400 pt-1">
              ¿Ya tienes una cuenta? <Link href="/auth/sign-in" className="text-[#00D4B3] hover:text-[#00b89c] font-semibold transition-colors">Inicia sesión</Link>
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
