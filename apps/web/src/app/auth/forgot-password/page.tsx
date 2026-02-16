'use client';

import { useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { Mail, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [rotation, setRotation] = useState(0);
  const logoControls = useAnimationControls();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsLoading(false);
    setIsSubmitted(true);
  };

  const handleLogoHover = () => {
    const newRotation = rotation + 720;
    setRotation(newRotation);
    logoControls.start({
      rotate: newRotation,
      transition: { duration: 1.5, ease: [0.4, 0, 0.2, 1] }
    });
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
              <Image src="/Logo.png" alt="Project Hub Logo" width={320} height={320}
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
          {!isSubmitted ? (
            <>
              <div className="text-center mb-8">
                <h1 className="text-2xl lg:text-3xl font-bold text-[#0A2540] dark:text-white mb-2">¿Olvidaste tu contraseña?</h1>
                <p className="text-[#6B7280] dark:text-gray-400 text-sm">Ingresa tu correo y te enviaremos instrucciones</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-[#0A2540] dark:text-gray-200 mb-1.5">Correo electrónico</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#9CA3AF]" />
                    <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com"
                      className="w-full pl-11 pr-4 py-3 rounded-lg border border-[#E5E7EB] dark:border-gray-700 bg-white dark:bg-[#0F1419] text-[#0A2540] dark:text-white placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0A2540]/10 dark:focus:ring-[#00D4B3]/20 focus:border-[#0A2540] dark:focus:border-[#00D4B3] transition-all text-sm" required />
                  </div>
                </div>

                <motion.button type="submit" disabled={isLoading}
                  className="w-full py-3 px-6 rounded-lg bg-[#0A2540] text-white font-medium flex items-center justify-center gap-2 hover:bg-[#122d4a] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  whileTap={{ scale: 0.99 }}>
                  {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><ArrowRight className="w-[18px] h-[18px]" /><span>Enviar instrucciones</span></>}
                </motion.button>

                <Link href="/auth/sign-in" className="flex items-center justify-center gap-2 text-sm text-[#6B7280] dark:text-gray-400 hover:text-[#0A2540] dark:hover:text-gray-200 transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Volver al inicio de sesión
                </Link>
              </form>
            </>
          ) : (
            <motion.div className="text-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <motion.div className="w-16 h-16 rounded-full bg-[#10B981]/10 flex items-center justify-center mx-auto mb-6"
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring" }}>
                <CheckCircle className="w-8 h-8 text-[#10B981]" />
              </motion.div>
              <h1 className="text-2xl font-bold text-[#0A2540] dark:text-white mb-2">¡Correo enviado!</h1>
              <p className="text-[#6B7280] dark:text-gray-400 text-sm mb-6">Hemos enviado las instrucciones a <span className="font-medium text-[#0A2540] dark:text-white">{email}</span></p>
              <Link href="/auth/sign-in" className="inline-flex items-center gap-2 py-3 px-6 rounded-lg bg-[#0A2540] text-white font-medium hover:bg-[#122d4a] transition-all">
                <ArrowLeft className="w-[18px] h-[18px]" /> Volver al inicio de sesión
              </Link>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
