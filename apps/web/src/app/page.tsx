'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import {
    ArrowRight,
    ArrowUpRight,
    FolderKanban,
    Moon,
    Sparkles,
    Sun,
    Users,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

const EASE_PREMIUM = [0.22, 1, 0.36, 1] as const;

const FEATURES = [
    {
        icon: FolderKanban,
        title: 'Proyectos',
        description:
            'Vistas de lista, tablero y línea de tiempo para cada proyecto, con progreso calculado en tiempo real.',
    },
    {
        icon: Users,
        title: 'Equipos',
        description:
            'Roles y permisos por workspace, sincronizados automáticamente con tu organización.',
    },
    {
        icon: Sparkles,
        title: 'IA integrada',
        description:
            'Gemini analiza tus documentos y propone tareas, ciclos y etiquetas listos para revisar.',
    },
] as const;

const fadeUp = (delay = 0): Variants => ({
    hidden: { opacity: 0, y: 16 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.45, delay, ease: EASE_PREMIUM },
    },
});

export default function HomePage() {
    const { isDark, toggleTheme } = useTheme();
    const prefersReducedMotion = useReducedMotion();

    const canvasBg = isDark ? '#0F1419' : '#F8FAFC';
    const textPrimary = isDark ? '#F8FAFC' : '#0A2540';
    const textSecondary = isDark ? '#8899A6' : '#64748B';
    const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(10,37,64,0.1)';
    const surface = isDark ? 'rgba(30,35,41,0.6)' : 'rgba(255,255,255,0.75)';

    return (
        <main
            className="relative min-h-screen overflow-hidden"
            style={{ backgroundColor: canvasBg, color: textPrimary }}
        >
            {/* Ambient glows — max two per viewport, per design system §4.7 */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                <div
                    className="absolute -top-40 right-[-10%] h-[36rem] w-[36rem] rounded-full"
                    style={{
                        background:
                            'radial-gradient(circle, color-mix(in srgb, #00D4B3 16%, transparent), transparent 70%)',
                        filter: 'blur(4rem)',
                    }}
                />
                <div
                    className="absolute bottom-[-14rem] left-[-10%] h-[30rem] w-[30rem] rounded-full"
                    style={{
                        background:
                            'radial-gradient(circle, color-mix(in srgb, #0A2540 45%, transparent), transparent 70%)',
                        filter: 'blur(4rem)',
                        opacity: isDark ? 0.5 : 0.2,
                    }}
                />
            </div>

            {/* Navbar — floating pattern, §17.1 */}
            <header className="sticky top-[0.7rem] z-[120] mx-auto max-w-[92rem] px-4 sm:px-6">
                <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: EASE_PREMIUM }}
                    className="flex h-16 items-center justify-between rounded-[1.15rem] border px-4 sm:px-5"
                    style={{
                        borderColor: border,
                        background: surface,
                        backdropFilter: 'blur(1.4rem) saturate(130%)',
                        WebkitBackdropFilter: 'blur(1.4rem) saturate(130%)',
                        boxShadow: '0 1rem 3rem rgb(2 10 20 / 0.10)',
                    }}
                >
                    <Link href="/" className="flex items-center gap-2.5">
                        <Image src="/Logo.png" alt="Project Hub" width={42} height={42} className="h-[2.6rem] w-[2.6rem] object-contain" />
                        <span
                            className="hidden text-lg sm:inline"
                            style={{ fontFamily: 'var(--font-system-display)', fontWeight: 400 }}
                        >
                            Project Hub
                        </span>
                    </Link>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleTheme}
                            aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                            className="grid h-9 w-9 place-items-center rounded-[0.7rem] border transition-colors"
                            style={{ borderColor: border, color: textSecondary }}
                        >
                            {isDark ? <Sun size={17} strokeWidth={1.8} /> : <Moon size={17} strokeWidth={1.8} />}
                        </button>

                        <Link
                            href="/auth/sign-in"
                            className="inline-flex items-center gap-1.5 rounded-[0.85rem] px-4 py-2 text-sm font-medium transition-transform hover:-translate-y-px"
                            style={{
                                background: '#00D4B3',
                                color: '#0A2540',
                                fontFamily: 'var(--font-system-ui)',
                                boxShadow: '0 0.85rem 2rem color-mix(in srgb, #00D4B3 25%, transparent)',
                            }}
                        >
                            Iniciar sesión
                            <ArrowRight size={15} strokeWidth={2} />
                        </Link>
                    </div>
                </motion.div>
            </header>

            {/* Hero */}
            <section className="relative z-10 mx-auto grid max-w-[92rem] items-center gap-12 px-6 pb-24 pt-16 sm:pt-24 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8 lg:pb-32">
                <div>
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={fadeUp(0)}
                        className="mb-7 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5"
                        style={{
                            background: 'color-mix(in srgb, #00D4B3 8%, transparent)',
                            border: '1px solid color-mix(in srgb, #00D4B3 24%, transparent)',
                        }}
                    >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#00D4B3' }} />
                        <span
                            style={{
                                fontFamily: 'var(--font-system-label)',
                                fontSize: '0.62rem',
                                fontWeight: 600,
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                color: isDark ? '#00D4B3' : '#009987',
                            }}
                        >
                            Gestión de proyectos con IA
                        </span>
                    </motion.div>

                    <motion.h1
                        initial="hidden"
                        animate="visible"
                        variants={fadeUp(0.05)}
                        className="mb-6"
                        style={{
                            fontFamily: 'var(--font-system-display)',
                            fontWeight: 300,
                            fontSize: 'clamp(2.6rem, 5.2vw, 4.6rem)',
                            lineHeight: 1.02,
                            letterSpacing: '-0.035em',
                        }}
                    >
                        Organiza el trabajo{' '}
                        <span style={{ color: '#00D4B3' }}>de tu equipo.</span>
                        <br />
                        Entrega con claridad.
                    </motion.h1>

                    <motion.p
                        initial="hidden"
                        animate="visible"
                        variants={fadeUp(0.1)}
                        className="mb-10 max-w-lg"
                        style={{
                            fontFamily: 'var(--font-system-ui)',
                            fontSize: '1rem',
                            lineHeight: 1.7,
                            color: textSecondary,
                        }}
                    >
                        Project Hub reúne proyectos, equipos y documentos en un solo espacio, con
                        inteligencia artificial que convierte tus archivos en tareas listas para
                        trabajar.
                    </motion.p>

                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={fadeUp(0.15)}
                        className="mb-10 flex flex-wrap items-center gap-3"
                    >
                        <Link href="/auth/sign-in">
                            <motion.span
                                whileHover={prefersReducedMotion ? undefined : { y: -2 }}
                                whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                                transition={{ duration: 0.18, ease: EASE_PREMIUM }}
                                className="inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-base font-semibold"
                                style={{
                                    background: '#00D4B3',
                                    color: '#0A2540',
                                    fontFamily: 'var(--font-system-ui)',
                                    boxShadow: '0 0.85rem 2.2rem color-mix(in srgb, #00D4B3 30%, transparent)',
                                }}
                            >
                                Iniciar sesión
                                <ArrowRight size={18} strokeWidth={2.2} />
                            </motion.span>
                        </Link>

                        <Link href="#producto">
                            <motion.span
                                whileHover={prefersReducedMotion ? undefined : { y: -2 }}
                                transition={{ duration: 0.18, ease: EASE_PREMIUM }}
                                className="inline-flex items-center gap-2 rounded-2xl border px-7 py-3.5 text-base font-medium"
                                style={{
                                    borderColor: border,
                                    color: textPrimary,
                                    fontFamily: 'var(--font-system-ui)',
                                }}
                            >
                                Conoce el producto
                                <ArrowUpRight size={16} strokeWidth={2} />
                            </motion.span>
                        </Link>
                    </motion.div>

                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={fadeUp(0.2)}
                        className="flex flex-wrap items-center gap-x-5 gap-y-2"
                    >
                        {['Proyectos', 'Equipos', 'IA integrada'].map((label) => (
                            <span
                                key={label}
                                className="inline-flex items-center gap-2"
                                style={{
                                    fontFamily: 'var(--font-system-label)',
                                    fontSize: '0.72rem',
                                    color: textSecondary,
                                }}
                            >
                                <span className="h-1 w-1 rounded-full" style={{ background: '#00D4B3' }} />
                                {label}
                            </span>
                        ))}
                    </motion.div>
                </div>

                {/* Decorative brand visual */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, delay: 0.2, ease: EASE_PREMIUM }}
                    className="relative hidden aspect-square w-full max-w-md justify-self-center lg:flex lg:items-center lg:justify-center"
                    aria-hidden="true"
                >
                    <div
                        className="absolute h-[85%] w-[85%] rounded-full"
                        style={{
                            background:
                                'radial-gradient(circle, color-mix(in srgb, #00D4B3 18%, transparent), transparent 72%)',
                            filter: 'blur(2.5rem)',
                        }}
                    />
                    <motion.div
                        animate={prefersReducedMotion ? undefined : { rotate: 360 }}
                        transition={
                            prefersReducedMotion
                                ? undefined
                                : { duration: 40, repeat: Infinity, ease: 'linear' }
                        }
                        className="relative h-[72%] w-[72%]"
                    >
                        <Image src="/Logo.png" alt="" fill className="object-contain drop-shadow-2xl" />
                    </motion.div>
                    {!prefersReducedMotion &&
                        [0, 1, 2].map((i) => (
                            <motion.span
                                key={i}
                                className="absolute h-2 w-2 rounded-full"
                                style={{ background: '#00D4B3', boxShadow: '0 0 12px rgba(0,212,179,0.7)' }}
                                animate={{
                                    x: [0, 14 * Math.cos((i * 2 * Math.PI) / 3), 0],
                                    y: [0, 14 * Math.sin((i * 2 * Math.PI) / 3), 0],
                                    opacity: [0.4, 1, 0.4],
                                }}
                                transition={{
                                    duration: 4 + i,
                                    repeat: Infinity,
                                    ease: 'easeInOut',
                                    delay: i * 0.6,
                                }}
                            />
                        ))}
                </motion.div>
            </section>

            {/* Features */}
            <section id="producto" className="relative z-10 mx-auto max-w-[92rem] px-6 pb-28">
                <div className="grid gap-5 sm:grid-cols-3">
                    {FEATURES.map((feature, i) => {
                        const Icon = feature.icon;
                        return (
                            <motion.div
                                key={feature.title}
                                initial="hidden"
                                animate="visible"
                                variants={fadeUp(0.05 * i)}
                                className="rounded-[1.25rem] border p-6"
                                style={{ borderColor: border, background: surface }}
                            >
                                <div
                                    className="mb-4 grid h-[2.2rem] w-[2.2rem] place-items-center rounded-[0.72rem] border"
                                    style={{
                                        borderColor: 'color-mix(in srgb, #00D4B3 24%, transparent)',
                                        background: 'color-mix(in srgb, #00D4B3 7%, transparent)',
                                        color: '#00D4B3',
                                    }}
                                >
                                    <Icon size={18} strokeWidth={1.75} />
                                </div>
                                <h3
                                    className="mb-2"
                                    style={{
                                        fontFamily: 'var(--font-system-display)',
                                        fontWeight: 400,
                                        fontSize: '1.2rem',
                                    }}
                                >
                                    {feature.title}
                                </h3>
                                <p
                                    style={{
                                        fontFamily: 'var(--font-system-ui)',
                                        fontSize: '0.85rem',
                                        lineHeight: 1.6,
                                        color: textSecondary,
                                    }}
                                >
                                    {feature.description}
                                </p>
                            </motion.div>
                        );
                    })}
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 border-t" style={{ borderColor: border }}>
                <div className="mx-auto flex max-w-[92rem] flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
                    <div className="flex items-center gap-2">
                        <Image src="/Logo.png" alt="Project Hub" width={20} height={20} className="h-5 w-5 opacity-70" />
                        <span style={{ fontFamily: 'var(--font-system-label)', fontSize: '0.75rem', color: textSecondary }}>
                            © {new Date().getFullYear()} Project Hub
                        </span>
                    </div>
                    <div className="flex items-center gap-6">
                        <Link
                            href="/privacy"
                            className="hover:underline"
                            style={{ fontFamily: 'var(--font-system-ui)', fontSize: '0.8rem', color: textSecondary }}
                        >
                            Política de Privacidad
                        </Link>
                        <Link
                            href="/terms"
                            className="hover:underline"
                            style={{ fontFamily: 'var(--font-system-ui)', fontSize: '0.8rem', color: textSecondary }}
                        >
                            Términos de Servicio
                        </Link>
                    </div>
                </div>
            </footer>
        </main>
    );
}
