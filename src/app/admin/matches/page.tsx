import { requireSession } from '@/lib/auth/require-session';
import { listMatches } from '@/lib/db/matches';
import { listTeams } from '@/lib/db/teams';
import MatchForm from './MatchForm';
import ShowStandingsButton from './ShowStandingsButton';

export const dynamic = 'force-dynamic';

export default async function MatchesPage() {
  await requireSession();
  const [matches, teams] = await Promise.all([listMatches(), listTeams()]);
  const teamNames = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  return (
    <main className="min-h-screen bg-gray-100 text-gray-900 p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Match results</h1>
        <ShowStandingsButton />
      </div>
      {matches.length === 0 && <p className="text-gray-500">The schedule has not been generated yet.</p>}
      {matches.map((m) => (
        <MatchForm key={m.id} match={m} teamNames={teamNames} />
      ))}
    </main>
  );
}
