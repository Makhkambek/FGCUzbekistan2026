import Link from 'next/link';
import { requireSession } from '@/lib/auth/require-session';
import { listTeams } from '@/lib/db/teams';
import { listMatches } from '@/lib/db/matches';
import { getAlliances } from '@/lib/db/alliances';

export const dynamic = 'force-dynamic';

const SECTIONS = [
  { href: '/admin/teams', label: 'Teams', desc: 'Add, edit, and remove competing teams' },
  { href: '/admin/schedule', label: 'Schedule', desc: 'Generate the qualification match schedule' },
  { href: '/admin/matches', label: 'Matches', desc: 'Enter and review match results' },
  { href: '/admin/alliances', label: 'Alliances & Playoffs', desc: 'Alliance selection and the playoff bracket' },
];

export default async function AdminPage() {
  await requireSession();
  const [teams, qualMatches, alliances] = await Promise.all([
    listTeams(), listMatches('qualification'), getAlliances(),
  ]);
  const playedCount = qualMatches.filter((m) => m.played).length;

  const stats: Record<string, string> = {
    '/admin/teams': `${teams.length} teams`,
    '/admin/schedule': `${qualMatches.length} matches scheduled`,
    '/admin/matches': `${playedCount} / ${qualMatches.length} played`,
    '/admin/alliances': `${alliances.length} alliances formed`,
  };

  return (
    <>
      <h1 className="text-2xl font-bold">FGC Uzbekistan admin</h1>
      <div className="grid sm:grid-cols-2 gap-4">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href}
            className="block bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-amber-300 hover:shadow-md transition-shadow">
            <h2 className="text-lg font-semibold text-gray-900">{s.label}</h2>
            <p className="text-sm text-gray-500 mt-1">{s.desc}</p>
            <p className="text-xs font-mono text-amber-700 mt-3">{stats[s.href]}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
