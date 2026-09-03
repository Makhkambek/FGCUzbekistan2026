import { requireSession } from '@/lib/auth/require-session';
import { listMatches } from '@/lib/db/matches';
import { listTeams } from '@/lib/db/teams';
import { getAlliances } from '@/lib/db/alliances';
import { matchScoresForDisplay } from '@/lib/standings';
import MatchList from './MatchList';
import ShowStandingsButton from './ShowStandingsButton';

export const dynamic = 'force-dynamic';

export default async function MatchesPage() {
  await requireSession();
  const [matches, teams, alliances] = await Promise.all([listMatches(), listTeams(), getAlliances()]);
  const teamNames = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  const rows = matches.map((m) => {
    let redScore: number | null = null;
    let blueScore: number | null = null;
    if (m.played) {
      // Isolated the same way /api/standings isolates it: one row with bad
      // data must not take down the whole list, it just shows no score.
      try {
        const s = matchScoresForDisplay(m);
        redScore = s.red;
        blueScore = s.blue;
      } catch (err) {
        console.error(`/admin/matches: failed to score match id=${m.id} (#${m.match_number}), skipping score`, err);
      }
    }
    return {
      id: m.id, number: m.match_number, phase: m.phase, played: !!m.played,
      red: [m.red1_id, m.red2_id, m.red3_id].map((id) => teamNames[id] ?? String(id)),
      blue: [m.blue1_id, m.blue2_id, m.blue3_id].map((id) => teamNames[id] ?? String(id)),
      redScore, blueScore,
    };
  });

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Match results</h1>
        <ShowStandingsButton />
      </div>
      {alliances.length > 0 && (
        // Alliance captains are written once, when the draft starts, and are
        // never recomputed. Re-scoring a qualification match now changes the
        // rankings but not the captains already seated — the operator has to
        // know that, because nothing else on the page says it.
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Alliance selection has started, so the qualification rankings are frozen.
          Editing a result here still updates the standings, but it will not move
          alliance captains — those were seated when the draft began.
        </p>
      )}
      {rows.length === 0
        ? <p className="text-gray-500">The schedule has not been generated yet.</p>
        : <MatchList matches={rows} />}
    </>
  );
}
