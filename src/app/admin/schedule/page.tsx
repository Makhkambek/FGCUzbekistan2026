import { requireSession } from '@/lib/auth/require-session';
import { listMatches } from '@/lib/db/matches';
import SchedulePanel from '../SchedulePanel';

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  await requireSession();
  const matches = await listMatches('qualification');

  return (
    <>
      <h1 className="text-2xl font-bold">Schedule</h1>
      <SchedulePanel matchCount={matches.length} />
    </>
  );
}
