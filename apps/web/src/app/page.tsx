'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from '@/contexts/ThemeContext';

export default function HomePage() {
    const { isDark, toggleTheme } = useTheme();

    return (
        <main className={`min-h-screen relative overflow-hidden ${isDark ? 'bg-[#0A0F14]' : 'bg-gradient-to-br from-slate-50 via-white to-slate-100'}`}>
            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Gradient Orbs */}
                <motion.div
                    className="absolute w-[600px] h-[600px] rounded-full blur-[120px] opacity-20"
                    style={{
                        background: 'linear-gradient(135deg, #00D4B3 0%, #0EA5E9 100%)',
                        top: '-200px',
                        right: '-200px'
                    }}
                    animate={{
                        scale: [1, 1.2, 1],
                        rotate: [0, 45, 0],
                    }}
                    transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: 'easeInOut'
                    }}
                />
                <motion.div
                    className="absolute w-[400px] h-[400px] rounded-full blur-[100px] opacity-15"
                    style={{
                        background: 'linear-gradient(135deg, #0A2540 0%, #00D4B3 100%)',
                        bottom: '-100px',
                        left: '-100px'
                    }}
                    animate={{
                        scale: [1, 1.15, 1],
                        rotate: [0, -30, 0],
                    }}
                    transition={{
                        duration: 15,
                        repeat: Infinity,
                        ease: 'easeInOut'
                    }}
                />
            </div>

            {/* Theme Toggle - Fixed top right */}
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="fixed top-4 right-4 z-50"
            >
                <button
                    onClick={toggleTheme}
                    className={`p-2.5 rounded-xl transition-all ${
                        isDark 
                            ? 'bg-white/10 hover:bg-white/15 text-white backdrop-blur-sm' 
                            : 'bg-white/80 hover:bg-white text-slate-600 backdrop-blur-sm shadow-lg'
                    }`}
                >
                    {isDark ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="5"/>
                            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                        </svg>
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                        </svg>
                    )}
                </button>
            </motion.div>

            {/* Hero Section */}
            <section className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-6 pb-20">
                <div className="max-w-4xl mx-auto text-center">
                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
                        style={{
                            background: isDark ? 'rgba(0, 212, 179, 0.1)' : 'rgba(0, 212, 179, 0.08)',
                            border: '1px solid rgba(0, 212, 179, 0.2)'
                        }}
                    >
                        <span className="w-2 h-2 rounded-full bg-[#00D4B3] animate-pulse" />
                        <span className={`text-sm font-medium ${isDark ? 'text-[#00D4B3]' : 'text-emerald-600'}`}>
                            Gestión de Proyectos y Equipos
                        </span>
                    </motion.div>

                    {/* Main Logo */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className="mb-8"
                    >
                        <Image 
                            src="/Logo.png" 
                            alt="Project Hub" 
                            width={180} 
                            height={180}
                            className="mx-auto w-36 h-36 sm:w-44 sm:h-44 object-contain drop-shadow-2xl"
                        />
                    </motion.div>

                    {/* Title */}
                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight ${
                            isDark ? 'text-white' : 'text-slate-900'
                        }`}
                    >
                        Bienvenido a{' '}
                        <span className="relative inline-block">
                            <span className="bg-gradient-to-r from-[#00D4B3] via-[#0EA5E9] to-[#00D4B3] bg-clip-text text-transparent">
                                Project Hub
                            </span>
                            <motion.span
                                className="absolute -bottom-2 left-0 right-0 h-1 rounded-full bg-gradient-to-r from-[#00D4B3] to-[#0EA5E9]"
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: 1 }}
                                transition={{ duration: 0.8, delay: 0.8 }}
                            />
                        </span>
                    </motion.h1>

                    {/* Subtitle */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.5 }}
                        className={`text-lg sm:text-xl md:text-2xl max-w-3xl mx-auto mb-12 leading-relaxed ${
                            isDark ? 'text-slate-400' : 'text-slate-600'
                        }`}
                    >
                        Sistema de gestión de proyectos y equipos.{' '}
                        <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            Organiza, colabora y entrega
                        </span>{' '}
                        con la eficiencia que tu equipo necesita.
                    </motion.p>

                    {/* CTA Button */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.6 }}
                    >
                        <Link href="/auth/sign-in">
                            <motion.button
                                whileHover={{ scale: 1.05, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                className="group relative px-10 py-4 rounded-2xl font-semibold text-lg text-white overflow-hidden"
                                style={{
                                    background: 'linear-gradient(135deg, #00D4B3 0%, #00B89C 100%)',
                                    boxShadow: '0 10px 40px rgba(0, 212, 179, 0.35)'
                                }}
                            >
                                <span className="relative z-10 flex items-center gap-3">
                                    Comenzar
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:translate-x-1">
                                        <path d="M5 12h14M12 5l7 7-7 7"/>
                                    </svg>
                                </span>
                                <motion.div
                                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                    animate={{
                                        x: ['-100%', '200%'],
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        ease: 'linear',
                                        repeatDelay: 1
                                    }}
                                />
                            </motion.button>
                        </Link>
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <footer className="absolute bottom-0 left-0 right-0 z-10 py-6 px-6">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Image src="/Logo.png" alt="Project Hub" width={20} height={20} className="w-5 h-5 opacity-60" />
                        <span className={`text-sm ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                            © 2026 Project Hub
                        </span>
                    </div>
                    <div className={`text-sm ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                        Sistema de Gestión de Proyectos
                    </div>
                </div>
            </footer>
        </main>
    );
}
