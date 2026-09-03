import { requireSession } from '@/lib/auth/require-session';
import { listMatches } from '@/lib/db/matches';
import { listTeams } from '@/lib/db/teams';
import MatchForm from './MatchForm';

export const dynamic = 'force-dynamic';

export default async function MatchesPage() {
  await requireSession();
  const [matches, teams] = await Promise.all([listMatches(), listTeams()]);
  const teamNames = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  return (
    <main className="min-h-screen bg-gray-100 text-gray-900 p-8 space-y-6">
      <h1 className="text-2xl font-bold">Результаты матчей</h1>
      {matches.length === 0 && <p className="text-gray-500">Расписание ещё не сгенерировано.</p>}
      {matches.map((m) => (
        <MatchForm key={m.id} match={m} teamNames={teamNames} />
      ))}
    </main>
  );
}
