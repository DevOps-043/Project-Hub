'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Loader2 } from 'lucide-react';

interface AdminWorkspaceLayoutProps {
  children: React.ReactNode;
}

export default function AdminWorkspaceLayout({ children }: AdminWorkspaceLayoutProps) {
  const { userRole } = useWorkspace();
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (userRole !== 'owner' && userRole !== 'admin') {
      router.replace(`/${orgSlug}/dashboard`);
    } else {
      setChecked(true);
    }
  }, [userRole, orgSlug, router]);

  if (!checked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[#00D4B3]" />
      </div>
    );
  }

  return <>{children}</>;
}
