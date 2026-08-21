'use client';

import { useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { Mail, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import styles from '@/components/auth/AuthForm.module.css';

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
          {!isSubmitted ? (
            <>
              <div className={styles.header}>
                <h1 className={styles.title}>¿Olvidaste tu contraseña?</h1>
                <p className={styles.subtitle}>Ingresa tu correo y te enviaremos instrucciones</p>
              </div>

              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.field}>
                  <label htmlFor="email">Correo electrónico</label>
                  <div className={styles.inputWrap}>
                    <Mail className={styles.inputIcon} aria-hidden="true" />
                    <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com"
                      className={styles.input} required />
                  </div>
                </div>

                <motion.button type="submit" disabled={isLoading}
                  className={styles.primary}
                  whileTap={{ scale: 0.99 }}>
                  {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><ArrowRight className="w-[18px] h-[18px]" /><span>Enviar instrucciones</span></>}
                </motion.button>

                <Link href="/auth/sign-in" className={styles.secondaryLink}>
                  <ArrowLeft className="w-4 h-4" /> Volver al inicio de sesión
                </Link>
              </form>
            </>
          ) : (
            <motion.div className={styles.success} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <motion.div className={styles.successIcon}
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring" }}>
                <CheckCircle className="w-8 h-8" />
              </motion.div>
              <h1 className={styles.title}>¡Correo enviado!</h1>
              <p>Hemos enviado las instrucciones a <strong>{email}</strong></p>
              <Link href="/auth/sign-in" className={styles.primaryLink}>
                <ArrowLeft className="w-[18px] h-[18px]" /> Volver al inicio de sesión
              </Link>
            </motion.div>
          )}
        </motion.div>
      </div>
    </main>
  );
}
