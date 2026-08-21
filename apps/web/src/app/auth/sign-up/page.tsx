'use client';

import { useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, User, ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import styles from '@/components/auth/AuthForm.module.css';

export default function SignUpPage() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const logoControls = useAnimationControls();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!acceptTerms) {
      setLocalError('Debes aceptar los términos y condiciones');
      return;
    }

    // Validaciones
    const nameParts = formData.name.trim().split(/\s+/);
    if (nameParts.length < 2) {
      setLocalError('Por favor, ingresa tu nombre completo (Nombre y Apellido)');
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(formData.email)) {
      setLocalError('Por favor, ingresa un correo electrónico válido');
      return;
    }

    if (!passwordChecks.length || !passwordChecks.uppercase || !passwordChecks.number) {
      setLocalError('La contraseña no cumple con los requisitos mínimos');
      return;
    }

    if (!passwordChecks.match) {
      setLocalError('Las contraseñas no coinciden');
      return;
    }

    setIsLoading(true);
    try {
      // Aquí iría la llamada al store de registro si existiera/estuviera implementado
      // Por ahora mantenemos el simulacro pero con validaciones reales
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log('Registro exitoso:', formData);
      setIsLoading(false);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Error al registrarse');
      setIsLoading(false);
    }
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
    <main className={styles.page}>
      <div className={styles.grid} aria-hidden="true" />

      <div className={styles.content}>
        <div className={styles.brand}>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1, y: [0, -15, 0] }}
            transition={{ opacity: { duration: 0.5 }, scale: { duration: 0.5 }, y: { duration: 5, repeat: Infinity, ease: "easeInOut" } }}
          >
            <motion.div animate={logoControls} onMouseEnter={handleLogoHover}>
              <Image src="/Logo.png" alt="Project Hub Logo" width={320} height={320}
                className={styles.logo} priority />
            </motion.div>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className={styles.card}
        >
          <div className={styles.header}>
            <h1 className={styles.title}>Crea tu cuenta</h1>
            <p className={styles.subtitle}>Comienza tu espacio de trabajo</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Mensaje de error */}
            {localError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={styles.error}
              >
                <div className={styles.errorMark}>
                  <span>!</span>
                </div>
                <p>{localError}</p>
              </motion.div>
            )}

            <div className={styles.field}>
              <label htmlFor="name">Nombre completo</label>
              <div className={styles.inputWrap}>
                <User className={styles.inputIcon} aria-hidden="true" />
                <input id="name" name="name" type="text" value={formData.name} onChange={handleChange} placeholder="Juan Pérez"
                  className={styles.input} required />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="email">Correo electrónico</label>
              <div className={styles.inputWrap}>
                <Mail className={styles.inputIcon} aria-hidden="true" />
                <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="tu@correo.com"
                  className={styles.input} required />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="password">Contraseña</label>
              <div className={styles.inputWrap}>
                <Lock className={styles.inputIcon} aria-hidden="true" />
                <input id="password" name="password" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={handleChange} placeholder="••••••••"
                  className={styles.input} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className={styles.reveal} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
              {formData.password && (
                <div className={styles.checks}>
                  <span className={passwordChecks.length ? styles.checkMet : undefined}><Check className="w-3 h-3 inline mr-1" />8+ caracteres</span>
                  <span className={passwordChecks.uppercase ? styles.checkMet : undefined}><Check className="w-3 h-3 inline mr-1" />Mayúscula</span>
                  <span className={passwordChecks.number ? styles.checkMet : undefined}><Check className="w-3 h-3 inline mr-1" />Número</span>
                </div>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="confirmPassword">Confirmar contraseña</label>
              <div className={styles.inputWrap}>
                <Lock className={styles.inputIcon} aria-hidden="true" />
                <input id="confirmPassword" name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={formData.confirmPassword} onChange={handleChange} placeholder="••••••••"
                  className={`${styles.input} ${formData.confirmPassword && !passwordChecks.match ? styles.inputInvalid : ''}`} required />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className={styles.reveal} aria-label={showConfirmPassword ? 'Ocultar confirmación' : 'Mostrar confirmación'}>
                  {showConfirmPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
              {formData.confirmPassword && !passwordChecks.match && <p className={styles.fieldError}>Las contraseñas no coinciden</p>}
            </div>

            <label className={styles.terms}>
              <input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} />
              <span>
                Acepto los <Link href="/terms">términos de servicio</Link> y la <Link href="/privacy">política de privacidad</Link>
              </span>
            </label>

            <motion.button type="submit" disabled={isLoading || !acceptTerms}
              className={styles.primary}
              whileTap={{ scale: 0.99 }}>
              {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><ArrowRight className="w-[18px] h-[18px]" /><span>Crear cuenta</span></>}
            </motion.button>

            <p className={styles.accountLink}>
              ¿Ya tienes una cuenta? <Link href="/auth/sign-in">Inicia sesión</Link>
            </p>
          </form>
        </motion.div>
      </div>
    </main>
  );
}
