import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth/require-session';
import { listAttempts } from '@/lib/db/skills';
import { listTeams } from '@/lib/db/teams';
import SkillsForm from '../SkillsForm';

export const dynamic = 'force-dynamic';

export default async function SkillsAttemptPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const attemptId = Number(id);

  const [attempts, teams] = await Promise.all([listAttempts(), listTeams()]);
  const attempt = attempts.find((a) => a.id === attemptId);
  if (!attempt) notFound();

  const names = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  // The next unscored attempt in the running order, offered after a save so
  // the referee moves down the list instead of back through it.
  const order = attempts.findIndex((a) => a.id === attemptId);
  const next = attempts.slice(order + 1).find((a) => !a.played) ?? null;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Link href="/admin/skills" className="text-sm text-gray-500 hover:text-gray-900">
        ← Back to skills
      </Link>
      <SkillsForm
        attempt={{
          id: attempt.id, round: attempt.round, alliance: attempt.alliance,
          teamName: names[attempt.team_id] ?? String(attempt.team_id),
          played: !!attempt.played,
          suppression: attempt.suppression, humanBalls: attempt.human_balls,
          climb: attempt.climb, extinguisher: attempt.extinguisher,
          minorFouls: attempt.minor_fouls, majorFouls: attempt.major_fouls,
          card: attempt.card,
        }}
        nextAttempt={next
          ? { id: next.id, label: `${names[next.team_id] ?? next.team_id} · attempt ${next.round}` }
          : null}
      />
    </div>
  );
}
