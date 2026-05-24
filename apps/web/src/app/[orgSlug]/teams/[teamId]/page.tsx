import { redirect } from 'next/navigation';

export default async function WorkspaceTeamPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = await params;
  redirect(`/${orgSlug}/teams/${teamId}/tasks`);
}
