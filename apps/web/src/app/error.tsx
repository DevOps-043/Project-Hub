'use client';

import { useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';
import { RetryButton, SystemState } from '@/components/system/SystemState';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <SystemState icon={TriangleAlert} eyebrow="Interrupción temporal" title="Algo no salió como esperábamos" description="Tu información permanece segura. Intenta recargar esta vista para continuar." action={<RetryButton onClick={reset} />} />;
}
