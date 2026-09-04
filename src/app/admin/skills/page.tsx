import { requireSession } from '@/lib/auth/require-session';
import { listTeams } from '@/lib/db/teams';
import { listAttempts, attemptScore, skillsTable } from '@/lib/db/skills';
import SkillsPanel from './SkillsPanel';

export const dynamic = 'force-dynamic';

export default async function SkillsPage() {
  await requireSession();
  const [teams, attempts] = await Promise.all([listTeams(), listAttempts()]);
  const names = Object.fromEntries(teams.map((t) => [t.id, t.name]));
  const table = await skillsTable(teams.map((t) => t.id));

  return (
    <>
      <h1 className="text-2xl font-bold">Skills</h1>
      <p className="text-gray-500 text-sm">
        One team on the field at a time. Pick who takes part and how many attempts each gets —
        the order runs through every team once before anyone takes their second attempt. A ball
        thrown in by the human player is worth 5, a ball scored by the robot is worth 1. The
        skills table is the sum of a team&apos;s attempts and does not touch the qualification ranking.
      </p>
      <SkillsPanel
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        attempts={attempts.map((a) => ({
          id: a.id, round: a.round, teamId: a.team_id,
          teamName: names[a.team_id] ?? String(a.team_id),
          alliance: a.alliance, played: !!a.played,
          score: a.played ? attemptScore(a) : null,
        }))}
        table={table.map((t) => ({ ...t, teamName: names[t.teamId] ?? String(t.teamId) }))}
      />
    </>
  );
}
