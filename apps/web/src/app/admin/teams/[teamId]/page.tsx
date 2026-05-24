import { redirect } from 'next/navigation';

export default async function GlobalAdminTeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  redirect(`/admin/teams/${teamId}/tasks`);
}
