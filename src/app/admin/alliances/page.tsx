import { requireSession } from '@/lib/auth/require-session';
import { listTeams } from '@/lib/db/teams';
import AlliancePicker from './AlliancePicker';

export const dynamic = 'force-dynamic';

export default async function AlliancesPage() {
  await requireSession();
  const teams = await listTeams();
  const teamNames = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  return (
    <>
      <h1 className="text-2xl font-bold">Alliance selection</h1>
      <p className="text-gray-500 text-sm">
        Captains are the top 3 teams by ranking. Each alliance has two pick dropdowns, filled in
        any order. Only teams that are not in an alliance yet can be picked — captains and teams
        already picked are off the board.
      </p>
      <AlliancePicker teamNames={teamNames} />
    </>
  );
}
