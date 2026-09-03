import { requireSession } from '@/lib/auth/require-session';
import { listMatches } from '@/lib/db/matches';
import { listTeams } from '@/lib/db/teams';
import SchedulePanel from '../SchedulePanel';

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  await requireSession();
  const [matches, teams] = await Promise.all([listMatches('qualification'), listTeams()]);

  return (
    <>
      <h1 className="text-2xl font-bold">Schedule</h1>
      <SchedulePanel matchCount={matches.length} teamCount={teams.length} />
    </>
  );
}
