import { requireSession } from '@/lib/auth/require-session';
import { listTeams } from '@/lib/db/teams';
import TeamsPanel from '../TeamsPanel';

export const dynamic = 'force-dynamic';

export default async function TeamsPage() {
  await requireSession();
  const teams = await listTeams();

  return (
    <>
      <h1 className="text-2xl font-bold">Teams</h1>
      <TeamsPanel teams={teams.map((t) => ({ id: t.id, name: t.name, region: t.region }))} />
    </>
  );
}
