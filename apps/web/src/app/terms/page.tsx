'use client';

import React from 'react';
import Link from 'next/link';
import { useTheme, themeColors } from '@/contexts/ThemeContext';

export default function TermsOfServicePage() {
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;

  const sections = [
    {
      title: "1. Aceptación de los Términos",
      content: "Al acceder y utilizar Project Hub, usted acepta cumplir y estar sujeto a estos Términos de Servicio. Si no está de acuerdo con alguna parte de estos términos, no podrá utilizar nuestros servicios."
    },
    {
      title: "2. Descripción del Servicio",
      content: "Project Hub es una plataforma de gestión de proyectos y colaboración que integra herramientas de inteligencia artificial y servicios de terceros, como Google Calendar, Google Drive y Google Docs, para mejorar la productividad mediante la sincronización de tareas, gestión de archivos y edición colaborativa de documentos."
    },
    {
      title: "3. Cuentas de Usuario",
      content: "Usted es responsable de mantener la confidencialidad de su cuenta y contraseña, y de todas las actividades que ocurran bajo su cuenta."
    },
    {
      title: "4. Propiedad Intelectual",
      content: "Todo el contenido, características y funcionalidad de la plataforma son propiedad de Project Hub y están protegidos por leyes de derechos de autor y otras leyes de propiedad intelectual."
    },
    {
      title: "5. Integración con Google (Calendar, Drive, Docs)",
      content: "Al utilizar las integraciones de Google en Project Hub, usted autoriza a la plataforma a acceder a sus datos de Calendar, Drive y Docs únicamente para los fines operativos del servicio. El usuario es responsable de los permisos otorgados y puede revocarlos en cualquier momento desde su cuenta de Google. Project Hub se compromete a cumplir con las políticas de datos de usuario de Google."
    },
    {
      title: "6. Uso Aceptable",
      content: "Usted acepta no utilizar el servicio para fines ilegales o para violar los derechos de otros. El uso indebido de las integraciones de IA o de API de terceros está estrictamente prohibido."
    },
    {
      title: "6. Limitación de Responsabilidad",
      content: "Project Hub no será responsable por daños indirectos, incidentales, especiales o consecuentes que resulten del uso o la imposibilidad de usar el servicio."
    },
    {
      title: "7. Modificaciones a los Términos",
      content: "Nos reservamos el derecho de modificar estos términos en cualquier momento. El uso continuado del servicio después de dichos cambios constituye su aceptación de los nuevos términos."
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
            Términos de Servicio
          </h1>
          <p className="mt-4 text-lg" style={{ color: colors.textMuted }}>
            Última actualización: {new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="space-y-12 shadow-2xl rounded-3xl p-8 sm:p-12 mb-12" style={{ backgroundColor: isDark ? 'rgba(30,35,41,0.5)' : colors.bgCard, border: `1px solid ${colors.border}` }}>
          {sections.map((section, idx) => (
            <secton key={idx}>
              <h2 className="text-2xl font-bold mb-4" style={{ color: '#00D4B3' }}>
                {section.title}
              </h2>
              <p className="text-lg leading-relaxed" style={{ color: colors.textSecondary }}>
                {section.content}
              </p>
            </secton>
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
