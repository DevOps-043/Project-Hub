'use client';

import { useParams } from 'next/navigation';
import { useWorkspace, getPanelPathForRole } from '@/contexts/WorkspaceContext';
import { TeamCyclesContent } from '@/components/panels/TeamCyclesContent';

export default function TeamCyclesPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const { userRole } = useWorkspace();
  const panelBase = getPanelPathForRole(orgSlug, userRole);
  return <TeamCyclesContent panelBase={panelBase} />;
}
