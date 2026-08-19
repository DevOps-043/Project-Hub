'use client';

import { useParams } from 'next/navigation';
import { useWorkspace, getPanelPathForRole } from '@/contexts/WorkspaceContext';
import { TeamTasksContent } from '@/components/panels/TeamTasksContent';

export default function TeamTasksPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const { userRole } = useWorkspace();
  const panelBase = getPanelPathForRole(orgSlug, userRole);
  return <TeamTasksContent panelBase={panelBase} workspaceSlug={orgSlug} />;
}
