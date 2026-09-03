import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth/require-session';
import { listMatches } from '@/lib/db/matches';
import { listTeams } from '@/lib/db/teams';
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

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Link href="/admin/matches" className="text-sm text-gray-500 hover:text-gray-900">
        ← Back to matches
      </Link>
      <MatchForm match={match} teamNames={teamNames} />
    </div>
  );
}
