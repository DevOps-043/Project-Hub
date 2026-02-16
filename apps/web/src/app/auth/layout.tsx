import type { Metadata } from 'next';
import AuthClientLayout from './AuthClientLayout';

export const metadata: Metadata = {
  title: 'Autenticación | Project Hub',
  description: 'Inicia sesión o regístrate en Project Hub para continuar tu aprendizaje',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthClientLayout>
      {children}
    </AuthClientLayout>
  );
}
