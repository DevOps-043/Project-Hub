'use client';

import { useParams } from 'next/navigation';
import { useWorkspace, getPanelPathForRole } from '@/contexts/WorkspaceContext';
import { TeamProjectsContent } from '@/components/panels/TeamProjectsContent';

export default function TeamProjectsPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const { userRole } = useWorkspace();
  const panelBase = getPanelPathForRole(orgSlug, userRole);
  return <TeamProjectsContent panelBase={panelBase} workspaceSlug={orgSlug} />;
}
