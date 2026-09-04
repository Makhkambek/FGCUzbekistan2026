import { NextResponse } from 'next/server';
import { listTeams } from '@/lib/db/teams';
import { listMatches } from '@/lib/db/matches';
import type { MatchRow } from '@/lib/db/matches';
import { getAlliances } from '@/lib/db/alliances';
import { standingsFromRows, matchScoresForDisplay } from '@/lib/standings';
import type { MatchScores } from '@/lib/scoring/types';
import { allianceMatchScore, computeAllianceStandings, finalsAreOver } from '@/lib/alliances/playoff';
import { skillsBoard } from '@/lib/db/skills';

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
      // matchScoresForDisplay, not computeMatchScores: a playoff red card
      // zeroes the alliance, and the match list must print the same number
      // the projector and the alliance table print.
      scoresById.set(r.id, matchScoresForDisplay(r));
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
      red: [r.red1_id, r.red2_id, r.red3_id]
        .filter((id): id is number => id !== null).map((id) => names[id] ?? id),
      blue: [r.blue1_id, r.blue2_id, r.blue3_id]
        .filter((id): id is number => id !== null).map((id) => names[id] ?? id),
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

  // Two teams to an alliance since 4 September 2026 — a seated alliance is a
  // captain and one pick.
  if (alliances.length === 3 && alliances.every((a) => a.pick1_team_id !== null)) {
    const scoresBySeed: { seed: number; score: number }[] = [];
    for (const r of validRows) {
      if (r.phase !== 'playoff' || !r.played) continue;
      const s = scoresById.get(r.id)!;
      const redSeed = r.red_alliance_id !== null ? allianceSeedById.get(r.red_alliance_id) : undefined;
      const blueSeed = r.blue_alliance_id !== null ? allianceSeedById.get(r.blue_alliance_id) : undefined;
      // A red card in the playoff zeroes the whole alliance for the match —
      // the cards have to be applied here, not just in the team standings.
      if (redSeed !== undefined) {
        scoresBySeed.push({
          seed: redSeed,
          score: allianceMatchScore(s.red, [r.card_red1, r.card_red2, r.card_red3]),
        });
      }
      if (blueSeed !== undefined) {
        scoresBySeed.push({
          seed: blueSeed,
          score: allianceMatchScore(s.blue, [r.card_blue1, r.card_blue2, r.card_blue3]),
        });
      }
    }
    allianceStandings = computeAllianceStandings(scoresBySeed).map((a) => {
      const alliance = alliances.find((x) => x.seed === a.seed)!;
      const teamIds = [alliance.captain_team_id, alliance.pick1_team_id]
        .filter((id): id is number => id !== null);
      return { seed: a.seed, total: a.total, matchesPlayed: a.matchesPlayed, teams: teamIds.map((id) => names[id] ?? String(id)) };
    });
  }

  // The skills table is its own award and never touches the ranking above —
  // it rides along on this response so the public board polls once, not twice.
  // Each team carries its own attempts: the board shows one team at a time.
  // Everyone in the running order is listed from the moment the order is
  // built, on nil points until they run — the hall reads this table to find
  // out who is up, not only who is done.
  //
  // None of it leaves the server until the finals are decided: skills is the
  // last award of the event, and a second table of numbers beside the bracket
  // splits the hall's attention at the one moment the tournament has been
  // building towards. Withheld here rather than hidden in the page, so there
  // is nothing on the board to find early.
  const board = finalsAreOver(rows.map((r) => ({ phase: r.phase, played: !!r.played })))
    ? await skillsBoard()
    : { standings: [], attempts: {} };
  const skills = board.standings
    .map((row) => ({
      ...row,
      name: names[row.teamId] ?? String(row.teamId),
      attempts: board.attempts[row.teamId] ?? [],
    }));

  return NextResponse.json({ standings, matches, allianceStandings, skills });
}
