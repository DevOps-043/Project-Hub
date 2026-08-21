'use client';

import { useParams } from 'next/navigation';
import { getPanelPathForRole, useWorkspace } from '@/contexts/WorkspaceContext';
import IssueDetailView from '@/components/tasks/IssueDetailView';

export default function IssueDetailPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const { userRole } = useWorkspace();
  const panelBase = getPanelPathForRole(orgSlug, userRole);
  return <IssueDetailView panelBase={panelBase} workspaceSlug={orgSlug} />;
}
