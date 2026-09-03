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
      <h1 className="text-2xl font-bold">Выбор альянсов</h1>
      <p className="text-gray-500 text-sm">
        Капитаны — топ-3 по рейтингу. Порядок выбора змейкой: 1→2→3, затем 3→2→1.
        Если капитан выбирает нижестоящего капитана, тот уходит в его альянс,
        а капитанство переходит следующей свободной команде.
      </p>
      <AlliancePicker teamNames={teamNames} />
    </main>
  );
}
