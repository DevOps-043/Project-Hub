'use client';

import { useState, useEffect } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Check, Sparkles } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/core/stores/authStore';
import { useTheme } from '@/contexts/ThemeContext';
import { resolvePostLoginDestination } from '@/lib/auth/post-login-redirect';

const EASE_PREMIUM = [0.22, 1, 0.36, 1] as const;

const LEARNING_SSO_ENABLED = process.env.NEXT_PUBLIC_LEARNING_SSO_ENABLED === 'true';

const SSO_ERROR_MESSAGES: Record<string, string> = {
    invalid_ticket: 'El enlace de acceso de SofLIA Learning expiró o ya se usó. Intenta de nuevo.',
    access_denied: 'Tu cuenta de SofLIA Learning no tiene acceso a Project Hub.',
    exchange_unavailable: 'SofLIA Learning no está disponible en este momento. Intenta de nuevo en unos minutos.',
    invalid_state: 'La solicitud de acceso expiró. Intenta de nuevo.',
};

export default function SignInPage() {
    const router = useRouter();
    const { login, isLoading, error, clearError, lockoutTimer, setLockoutTimer } = useAuthStore();
    const { isDark } = useTheme();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const [rotation, setRotation] = useState(0);
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [returnUrlParam, setReturnUrlParam] = useState<string | null>(null);
    const [ssoError, setSsoError] = useState<string | null>(null);
    const logoControls = useAnimationControls();

    // Se lee directo de window.location (no useSearchParams) para no forzar
    // un Suspense boundary en esta página client-only.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        setReturnUrlParam(params.get('returnUrl'));
        const ssoErrorCode = params.get('sso_error');
        if (ssoErrorCode) {
            setSsoError(SSO_ERROR_MESSAGES[ssoErrorCode] || 'No se pudo completar el acceso con SofLIA Learning.');
        }
    }, []);

    const learningStartUrl = `/api/auth/learning/start${returnUrlParam ? `?returnUrl=${encodeURIComponent(returnUrlParam)}` : ''}`;

    const textPrimary = isDark ? '#F8FAFC' : '#0A2540';
    const textSecondary = isDark ? '#8899A6' : '#64748B';
    const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(10,37,64,0.1)';
    const cardSurface = isDark ? 'rgba(30,35,41,0.7)' : 'rgba(255,255,255,0.85)';
    const inputSurface = isDark ? 'rgba(15,20,25,0.6)' : '#F8FAFC';

    useEffect(() => {
        if (lockoutTimer > 0) {
            const timer = setInterval(() => {
                setLockoutTimer(lockoutTimer - 1);
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [lockoutTimer, setLockoutTimer]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (lockoutTimer > 0) return;

        setLocalError(null);
        clearError();

        const cleanedIdentifier = email.trim();

        if (!cleanedIdentifier) {
            setLocalError('Por favor, ingresa tu correo o usuario');
            return;
        }

        if (cleanedIdentifier.includes('@')) {
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!emailRegex.test(cleanedIdentifier)) {
                setLocalError('El formato de correo no es válido (ej: usuario@dominio.com)');
                return;
            }
        } else {
            const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
            if (!usernameRegex.test(cleanedIdentifier)) {
                setLocalError('El usuario debe tener entre 3 y 20 caracteres (letras, números, _ o -)');
                return;
            }
        }

        if (password.length < 6) {
            setLocalError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        try {
            await login({ email: cleanedIdentifier, password });

            const state = useAuthStore.getState();
            const user = state.user;
            const workspaces = state.workspaces;

            setFailedAttempts(0);

            const destination = resolvePostLoginDestination({
                workspaces,
                role: user?.role,
                permissionLevel: user?.permissionLevel,
                returnUrl: returnUrlParam,
            });
            router.push(destination);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Error al iniciar sesión';

            if (lockoutTimer <= 0) {
                const newFailedAttempts = failedAttempts + 1;
                setFailedAttempts(newFailedAttempts);

                if (newFailedAttempts >= 3) {
                    setLockoutTimer(30);
                    setLocalError('Demasiados intentos fallidos. Acceso bloqueado por 30 segundos.');
                } else {
                    setLocalError(`${errorMessage} (Intento ${newFailedAttempts} de 3)`);
                }
            } else {
                setLocalError(errorMessage);
            }
        }
    };

    const handleLogoHover = () => {
        if (isLoading) return;
        const newRotation = rotation + 720;
        setRotation(newRotation);
        logoControls.start({
            rotate: newRotation,
            transition: { duration: 1.5, ease: [0.4, 0, 0.2, 1] },
        });
    };

    useEffect(() => {
        if (isLoading) {
            logoControls.start({
                rotate: rotation + 360,
                transition: { duration: 1, ease: 'linear', repeat: Infinity },
            });
        } else {
            logoControls.stop();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading]);

    return (
        <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden p-4 sm:p-6 lg:p-12">
            {/* Ambient glows — max two per viewport, §4.7 */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                <div
                    className="absolute -top-32 right-[-8%] h-[34rem] w-[34rem] rounded-full"
                    style={{
                        background: 'radial-gradient(circle, color-mix(in srgb, #00D4B3 14%, transparent), transparent 70%)',
                        filter: 'blur(4rem)',
                    }}
                />
                <div
                    className="absolute bottom-[-12rem] left-[-8%] h-[28rem] w-[28rem] rounded-full"
                    style={{
                        background: 'radial-gradient(circle, color-mix(in srgb, #0A2540 45%, transparent), transparent 70%)',
                        filter: 'blur(4rem)',
                        opacity: isDark ? 0.5 : 0.2,
                    }}
                />
            </div>

            <div className="relative flex w-full max-w-6xl flex-col items-center justify-between gap-10 lg:flex-row lg:gap-20">
                {/* Visual flotante */}
                <div className="hidden flex-1 items-center justify-center md:flex">
                    <motion.div
                        className="relative cursor-grab active:cursor-grabbing"
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1, y: [0, -14, 0] }}
                        transition={{
                            opacity: { duration: 0.5 },
                            scale: { duration: 0.5 },
                            y: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
                        }}
                    >
                        <div
                            className="absolute left-1/2 top-1/2 h-[85%] w-[85%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                            style={{
                                background: 'radial-gradient(circle, color-mix(in srgb, #00D4B3 18%, transparent), transparent 72%)',
                                filter: 'blur(2.5rem)',
                            }}
                        />
                        <motion.div
                            animate={logoControls}
                            onMouseEnter={handleLogoHover}
                            drag
                            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                            onDragStart={handleLogoHover}
                            className="relative"
                        >
                            <Image
                                src="/Logo.png"
                                alt="Project Hub"
                                width={320}
                                height={320}
                                className="h-48 w-48 object-contain md:h-64 md:w-64 lg:h-72 lg:w-72"
                                style={{ filter: 'drop-shadow(0 25px 50px rgba(0, 212, 179, 0.2))' }}
                                priority
                            />
                        </motion.div>
                    </motion.div>
                </div>

                {/* Tarjeta de acceso */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1, ease: EASE_PREMIUM }}
                    className="w-full max-w-[480px] rounded-[1.65rem] border p-7 sm:p-10"
                    style={{
                        borderColor: border,
                        background: cardSurface,
                        backdropFilter: 'blur(1.5rem) saturate(130%)',
                        WebkitBackdropFilter: 'blur(1.5rem) saturate(130%)',
                        boxShadow: '0 2.5rem 6rem rgb(2 12 22 / 0.28), inset 0 1px 0 rgb(255 255 255 / 0.06)',
                    }}
                >
                    <div className="mb-9 text-center">
                        <h1
                            className="mb-2.5"
                            style={{
                                fontFamily: 'var(--font-system-display)',
                                fontWeight: 300,
                                fontSize: 'clamp(1.9rem, 3.5vw, 2.5rem)',
                                letterSpacing: '-0.03em',
                                color: textPrimary,
                            }}
                        >
                            Bienvenido de nuevo
                        </h1>
                        <p style={{ fontFamily: 'var(--font-system-ui)', fontSize: '0.9rem', color: textSecondary }}>
                            Gestiona tus flujos de trabajo y proyectos
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {(localError || error || ssoError) && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-3 rounded-[0.9rem] border p-3.5"
                                style={{
                                    borderColor: 'color-mix(in srgb, #EF4444 32%, transparent)',
                                    background: 'color-mix(in srgb, #EF4444 8%, transparent)',
                                }}
                            >
                                <AlertCircle size={18} className="shrink-0" style={{ color: '#EF4444' }} />
                                <p style={{ fontFamily: 'var(--font-system-ui)', fontSize: '0.8rem', color: isDark ? '#FCA5A5' : '#B91C1C' }}>
                                    {localError || error || ssoError}
                                </p>
                            </motion.div>
                        )}

                        <div>
                            <label
                                htmlFor="email"
                                className="mb-1.5 block"
                                style={{
                                    fontFamily: 'var(--font-system-label)',
                                    fontSize: '0.62rem',
                                    fontWeight: 600,
                                    letterSpacing: '0.1em',
                                    textTransform: 'uppercase',
                                    color: textSecondary,
                                }}
                            >
                                Correo o usuario
                            </label>
                            <div className="relative">
                                <Mail size={17} strokeWidth={1.8} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: textSecondary }} />
                                <input
                                    id="email"
                                    type="text"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="tu@correo.com o usuario123"
                                    autoComplete="username"
                                    className="w-full rounded-[0.9rem] border py-3 pl-11 pr-4 text-sm outline-none transition-colors"
                                    style={{
                                        borderColor: border,
                                        background: inputSurface,
                                        color: textPrimary,
                                        fontFamily: 'var(--font-system-ui)',
                                    }}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="mb-1.5 block"
                                style={{
                                    fontFamily: 'var(--font-system-label)',
                                    fontSize: '0.62rem',
                                    fontWeight: 600,
                                    letterSpacing: '0.1em',
                                    textTransform: 'uppercase',
                                    color: textSecondary,
                                }}
                            >
                                Contraseña
                            </label>
                            <div className="relative">
                                <Lock size={17} strokeWidth={1.8} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: textSecondary }} />
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    className="w-full rounded-[0.9rem] border py-3 pl-11 pr-11 text-sm outline-none transition-colors"
                                    style={{
                                        borderColor: border,
                                        background: inputSurface,
                                        color: textPrimary,
                                        fontFamily: 'var(--font-system-ui)',
                                    }}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                                    style={{ color: textSecondary }}
                                >
                                    {showPassword ? <EyeOff size={17} strokeWidth={1.8} /> : <Eye size={17} strokeWidth={1.8} />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <label className="group flex cursor-pointer items-center gap-2">
                                <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={rememberMe}
                                    onClick={() => setRememberMe(!rememberMe)}
                                    className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[0.4rem] border-2 transition-colors"
                                    style={{
                                        borderColor: rememberMe ? '#00D4B3' : border,
                                        background: rememberMe ? '#00D4B3' : 'transparent',
                                    }}
                                >
                                    {rememberMe && <Check size={12} strokeWidth={3} color={isDark ? '#0A0D12' : '#FFFFFF'} />}
                                </button>
                                <span style={{ fontFamily: 'var(--font-system-ui)', fontSize: '0.8rem', color: textSecondary }}>
                                    Recordarme
                                </span>
                            </label>
                            <Link
                                href="/auth/forgot-password"
                                className="hover:opacity-80"
                                style={{ fontFamily: 'var(--font-system-ui)', fontSize: '0.8rem', fontWeight: 500, color: '#00D4B3' }}
                            >
                                ¿Olvidaste tu contraseña?
                            </Link>
                        </div>

                        <motion.button
                            type="submit"
                            disabled={isLoading || lockoutTimer > 0}
                            whileTap={isLoading || lockoutTimer > 0 ? undefined : { scale: 0.99 }}
                            className="flex w-full items-center justify-center gap-2 rounded-[0.9rem] py-3.5 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                            style={{
                                background: '#00D4B3',
                                fontFamily: 'var(--font-system-ui)',
                                boxShadow: '0 0.85rem 2.2rem color-mix(in srgb, #00D4B3 30%, transparent)',
                            }}
                        >
                            {isLoading ? (
                                <span
                                    className="h-4 w-4 animate-spin rounded-full border-2"
                                    style={{ borderColor: 'rgba(255,255,255,0.35)', borderTopColor: '#FFFFFF' }}
                                />
                            ) : lockoutTimer > 0 ? (
                                <span>Bloqueado ({lockoutTimer}s)</span>
                            ) : (
                                <>
                                    <span>Iniciar sesión</span>
                                    <ArrowRight size={16} strokeWidth={2.2} />
                                </>
                            )}
                        </motion.button>
                    </form>

                    {LEARNING_SSO_ENABLED && (
                        <>
                            <div className="my-6 flex items-center gap-3" aria-hidden="true">
                                <span className="h-px flex-1" style={{ background: border }} />
                                <span style={{ fontFamily: 'var(--font-system-label)', fontSize: '0.65rem', color: textSecondary }}>
                                    o
                                </span>
                                <span className="h-px flex-1" style={{ background: border }} />
                            </div>

                            <a
                                href={learningStartUrl}
                                className="flex w-full items-center justify-center gap-2 rounded-[0.9rem] border py-3.5 text-sm font-medium transition-colors hover:opacity-90"
                                style={{
                                    borderColor: border,
                                    background: inputSurface,
                                    color: textPrimary,
                                    fontFamily: 'var(--font-system-ui)',
                                }}
                            >
                                <Sparkles size={16} strokeWidth={1.8} style={{ color: '#00D4B3' }} />
                                <span>Continuar con SofLIA Learning</span>
                            </a>
                        </>
                    )}

                    <p className="mt-7 text-center" style={{ fontFamily: 'var(--font-system-ui)', fontSize: '0.8rem', color: textSecondary }}>
                        ¿No tienes una cuenta?{' '}
                        <Link href="/auth/sign-up" className="font-medium hover:opacity-80" style={{ color: '#00D4B3' }}>
                            Regístrate aquí
                        </Link>
                    </p>
                </motion.div>
            </div>
        </div>
    );
}
