'use client';

import React from 'react';
import Link from 'next/link';
import { useTheme, themeColors } from '@/contexts/ThemeContext';

export default function PrivacyPolicyPage() {
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;

  const sections = [
    {
      title: "1. Información que recopilamos",
      content: "Recopilamos información que usted nos proporciona directamente cuando crea una cuenta, utiliza nuestros servicios o se comunica con nosotros. Esto incluye su nombre, dirección de correo electrónico y cualquier otra información que elija proporcionar."
    },
    {
      title: "2. Uso de datos de Google",
      content: "Nuestra aplicación utiliza las servicios de Google API para integrarse con Google Calendar, Google Drive y Google Docs. Solo solicitamos acceso a los datos necesarios para proporcionar funcionalidades como la sincronización de calendarios, el adjunto de archivos de Google Drive a proyectos y la creación o edición de documentos de Google Docs directamente desde nuestra plataforma. No vendemos ni compartimos sus datos de Google con terceros."
    },
    {
      title: "3. Política de uso limitado",
      content: "El uso y la transferencia por parte de Project Hub de la información recibida de las API de Google a cualquier otra aplicación se adherirá a la Política de datos del usuario de los servicios de la API de Google, incluidos los requisitos de uso limitado."
    },
    {
      title: "4. Almacenamiento y Seguridad",
      content: "Implementamos medidas de seguridad técnicas y organizativas para proteger sus datos personales contra el acceso, alteración o divulgación no autorizados."
    },
    {
      title: "5. Procesamiento de IA",
      content: "Nuestra plataforma utiliza servicios de Inteligencia Artificial para el análisis de proyectos. Los datos enviados a estos servicios se procesan de forma segura y no se utilizan para entrenar modelos públicos sin su consentimiento explícito."
    },
    {
      title: "6. Sus Derechos",
      content: "Usted tiene derecho a acceder, corregir o eliminar su información personal en cualquier momento a través de la configuración de su cuenta."
    },
    {
      title: "7. Contacto",
      content: "Si tiene alguna pregunta sobre esta Política de Privacidad, puede contactarnos a través de la plataforma."
    }
  ];

  return (
    <div className="min-h-screen py-16 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: colors.bgPrimary }}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <Link href="/" className="inline-flex items-center gap-2 mb-8 text-[#00D4B3] hover:underline font-medium">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Volver al inicio
          </Link>
          <h1 className="text-4xl font-extrabold sm:text-5xl" style={{ color: colors.textPrimary }}>
            Política de Privacidad
          </h1>
          <p className="mt-4 text-lg" style={{ color: colors.textMuted }}>
            Última actualización: {new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="space-y-12 shadow-2xl rounded-3xl p-8 sm:p-12 mb-12" style={{ backgroundColor: isDark ? 'rgba(30,35,41,0.5)' : colors.bgCard, border: `1px solid ${colors.border}` }}>
          {sections.map((section, idx) => (
            <section key={idx}>
              <h2 className="text-2xl font-bold mb-4" style={{ color: '#00D4B3' }}>
                {section.title}
              </h2>
              <p className="text-lg leading-relaxed" style={{ color: colors.textSecondary }}>
                {section.content}
              </p>
            </section>
          ))}
        </div>

        <footer className="text-center py-8" style={{ borderTop: `1px solid ${colors.border}` }}>
          <p className="text-sm" style={{ color: colors.textMuted }}>
            &copy; {new Date().getFullYear()} Project Hub. Todos los derechos reservados.
          </p>
        </footer>
      </div>
    </div>
  );
}
