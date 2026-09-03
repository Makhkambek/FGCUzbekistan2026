import { NextResponse } from 'next/server';
import { listTeams } from '@/lib/db/teams';
import { listMatches } from '@/lib/db/matches';
import type { MatchRow } from '@/lib/db/matches';
import { getAlliances } from '@/lib/db/alliances';
import { standingsFromRows, matchRowToInput } from '@/lib/standings';
import { computeMatchScores } from '@/lib/scoring/match';
import type { MatchScores } from '@/lib/scoring/types';
import { computeAllianceStandings } from '@/lib/alliances/playoff';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [teams, rows] = await Promise.all([listTeams(), listMatches()]);
  const names = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  // Scores are computed row by row with failures isolated: if one match cannot
  // be scored (corrupt data and the like), the rest of the board must not go down.
  // Such a row is dropped from the standings (so the same computation is not run
  // again on data already known to be bad) and gets null scores in the match list.
  const validRows: MatchRow[] = [];
  const scoresById = new Map<number, MatchScores>();

  for (const r of rows) {
    try {
      scoresById.set(r.id, computeMatchScores(matchRowToInput(r)));
      validRows.push(r);
    } catch (err) {
      console.error(`/api/standings: failed to score match id=${r.id} (#${r.match_number}), skipping row`, err);
    }
  }

  // The public ranking is a QUALIFICATION ranking — playoff results must
  // never feed back into it (the alliance-selection endpoint already reads
  // listMatches('qualification') for the same reason). The match list below
  // still shows every phase; only the row set going into standingsFromRows
  // is restricted here.
  const qualificationRows = validRows.filter((r) => r.phase === 'qualification');
  const standings = standingsFromRows(teams.map((t) => t.id), qualificationRows).map((s) => ({
    ...s, name: names[s.teamId] ?? String(s.teamId),
  }));

  // Playoff matches carry the alliance id of each side — the display's "next
  // match" ticker uses this to say "Alliance 2 vs Alliance 3" instead of
  // listing six team names for a playoff match.
  const alliances = await getAlliances();
  const allianceSeedById = new Map(alliances.map((a) => [a.id, a.seed]));

  const matches = rows.map((r) => {
    const s = scoresById.get(r.id) ?? null;
    return {
      id: r.id, number: r.match_number, phase: r.phase, played: !!r.played,
      red: [r.red1_id, r.red2_id, r.red3_id].map((id) => names[id] ?? id),
      blue: [r.blue1_id, r.blue2_id, r.blue3_id].map((id) => names[id] ?? id),
      redScore: r.played && s ? s.red : null,
      blueScore: r.played && s ? s.blue : null,
      redSeed: r.red_alliance_id !== null ? allianceSeedById.get(r.red_alliance_id) ?? null : null,
      blueSeed: r.blue_alliance_id !== null ? allianceSeedById.get(r.blue_alliance_id) ?? null : null,
    };
  });

  // Alliance (playoff) standings — only meaningful once all three alliances
  // are fully picked. Reuses the match scores already computed above instead
  // of recomputing them.
  let allianceStandings: {
    seed: number; total: number; matchesPlayed: number; teams: string[];
  }[] | null = null;

  if (alliances.length === 3 && alliances.every((a) => a.pick1_team_id !== null && a.pick2_team_id !== null)) {
    const scoresBySeed: { seed: number; score: number }[] = [];
    for (const r of validRows) {
      if (r.phase !== 'playoff' || !r.played) continue;
      const s = scoresById.get(r.id)!;
      const redSeed = r.red_alliance_id !== null ? allianceSeedById.get(r.red_alliance_id) : undefined;
      const blueSeed = r.blue_alliance_id !== null ? allianceSeedById.get(r.blue_alliance_id) : undefined;
      if (redSeed !== undefined) scoresBySeed.push({ seed: redSeed, score: s.red });
      if (blueSeed !== undefined) scoresBySeed.push({ seed: blueSeed, score: s.blue });
    }
    allianceStandings = computeAllianceStandings(scoresBySeed).map((a) => {
      const alliance = alliances.find((x) => x.seed === a.seed)!;
      const teamIds = [alliance.captain_team_id, alliance.pick1_team_id, alliance.pick2_team_id]
        .filter((id): id is number => id !== null);
      return { seed: a.seed, total: a.total, matchesPlayed: a.matchesPlayed, teams: teamIds.map((id) => names[id] ?? String(id)) };
    });
  }

  return NextResponse.json({ standings, matches, allianceStandings });
}
