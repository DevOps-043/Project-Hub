import { redirect } from 'next/navigation';

export default async function AdminWorkspaceTeamPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = await params;
  redirect(`/${orgSlug}/admin/teams/${teamId}/tasks`);
}
