import { requireSession } from '@/lib/auth/require-session';
import { listTeams } from '@/lib/db/teams';
import AlliancePicker from './AlliancePicker';

export const dynamic = 'force-dynamic';

export default async function AlliancesPage() {
  await requireSession();
  const teams = await listTeams();
  const teamNames = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  return (
    <main className="min-h-screen bg-gray-100 text-gray-900 p-8 space-y-6">
      <h1 className="text-2xl font-bold">Alliance selection</h1>
      <p className="text-gray-500 text-sm">
        Captains are the top 3 teams by ranking. Picks run in serpentine order: 1→2→3, then 3→2→1.
        If a captain picks a lower-seeded captain, that team joins the picking alliance and
        the captaincy passes to the next available team.
      </p>
      <AlliancePicker teamNames={teamNames} />
    </main>
  );
}
