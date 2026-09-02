import { NextResponse } from 'next/server';
import { listTeams } from '@/lib/db/teams';
import { listMatches } from '@/lib/db/matches';
import { standingsFromRows, matchRowToInput } from '@/lib/standings';
import { computeMatchScores } from '@/lib/scoring/match';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [teams, rows] = await Promise.all([listTeams(), listMatches()]);
  const names = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  const standings = standingsFromRows(teams.map((t) => t.id), rows).map((s) => ({
    ...s, name: names[s.teamId] ?? String(s.teamId),
  }));

  const matches = rows.map((r) => {
    const s = computeMatchScores(matchRowToInput(r));
    return {
      id: r.id, number: r.match_number, phase: r.phase, played: !!r.played,
      red: [r.red1_id, r.red2_id, r.red3_id].map((id) => names[id] ?? id),
      blue: [r.blue1_id, r.blue2_id, r.blue3_id].map((id) => names[id] ?? id),
      redScore: r.played ? s.red : null,
      blueScore: r.played ? s.blue : null,
    };
  });

  return NextResponse.json({ standings, matches });
}
