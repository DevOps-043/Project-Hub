'use client';

import { ShieldAlert } from 'lucide-react';
import { BackButton, HomeLink, SystemState } from '@/components/system/SystemState';

export default function UnauthorizedPage() {
  return <SystemState icon={ShieldAlert} eyebrow="Acceso restringido" title="Esta sección requiere otro permiso" description="Tu sesión está activa, pero tu rol no incluye acceso a esta vista. Si consideras que es un error, contacta a un administrador." action={<><BackButton /><HomeLink /></>} />;
}
