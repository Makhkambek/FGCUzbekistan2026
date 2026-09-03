import { requireSession } from '@/lib/auth/require-session';
import { listTeams } from '@/lib/db/teams';
import { listMatches } from '@/lib/db/matches';
import TeamsPanel from './TeamsPanel';
import SchedulePanel from './SchedulePanel';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  await requireSession();
  const [teams, matches] = await Promise.all([listTeams(), listMatches('qualification')]);

  return (
    <main className="min-h-screen bg-gray-100 text-gray-900 p-8 space-y-6">
      <h1 className="text-2xl font-bold">Админка FGC Uzbekistan</h1>
      <a href="/admin/matches" className="inline-block text-amber-600 hover:text-amber-700">
        → Результаты матчей
      </a>
      <a href="/admin/alliances" className="inline-block ml-4 text-amber-600 hover:text-amber-700">
        → Альянсы и плей-офф
      </a>
      <TeamsPanel teams={teams.map((t) => ({ id: t.id, name: t.name, region: t.region }))} />
      <SchedulePanel matchCount={matches.length} />
    </main>
  );
}
