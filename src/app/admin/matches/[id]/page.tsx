import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth/require-session';
import { listMatches } from '@/lib/db/matches';
import { listTeams } from '@/lib/db/teams';
import { matchLabel } from '@/lib/match-label';
import MatchForm from '../MatchForm';

export const dynamic = 'force-dynamic';

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const matchId = Number(id);

  const [matches, teams] = await Promise.all([listMatches(), listTeams()]);
  const match = matches.find((m) => m.id === matchId);
  if (!match) notFound();

  const teamNames = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  // Scoring a match is followed by scoring the next one, so the form offers
  // that jump instead of sending the referee back through the list. The next
  // one is the following unplayed match of the same phase — the phase matters
  // during the playoff, where the leftover qualification matches are not next.
  const next = matches
    .filter((m) => m.phase === match.phase && m.match_number > match.match_number && !m.played)
    .sort((a, b) => a.match_number - b.match_number)[0] ?? null;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Link href="/admin/matches" className="text-sm text-gray-500 hover:text-gray-900">
        ← Back to matches
      </Link>
      <MatchForm match={match} teamNames={teamNames}
        nextMatch={next ? { id: next.id, label: matchLabel(next.phase, next.match_number) } : null} />
    </div>
  );
}
