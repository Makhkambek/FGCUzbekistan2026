import { NextResponse } from 'next/server';
import { getDisplayState } from '@/lib/db/display';
import { getMatchById, listMatches } from '@/lib/db/matches';
import { listTeams } from '@/lib/db/teams';
import { getAlliances } from '@/lib/db/alliances';
import { standingsFromRows } from '@/lib/standings';
import { buildDisplayPayload } from '@/lib/display';
import type { RankMap } from '@/lib/display';

export const dynamic = 'force-dynamic';

/**
 * The number shown beside each team on the match screen.
 *
 * During the playoff it is the seed of the alliance the team is playing for —
 * the same number for all three of them, because that is what the hall is
 * following by then. Otherwise it is the team's own place in the
 * qualification ranking, computed from the same rows as /api/standings so the
 * projector and the public board can never disagree about who is third.
 */
async function rankMap(phase: 'qualification' | 'playoff', teamIds: number[]): Promise<RankMap> {
  if (phase === 'playoff') {
    const alliances = await getAlliances();
    const ranks: RankMap = {};
    for (const a of alliances) {
      for (const id of [a.captain_team_id, a.pick1_team_id, a.pick2_team_id]) {
        if (id) ranks[id] = a.seed;
      }
    }
    return ranks;
  }

  const qualRows = await listMatches('qualification');
  const ranks: RankMap = {};
  standingsFromRows(teamIds, qualRows).forEach((s, i) => { ranks[s.teamId] = i + 1; });
  return ranks;
}

export async function GET() {
  const state = await getDisplayState();
  const [match, teams] = await Promise.all([
    state.matchId !== null ? getMatchById(state.matchId) : null,
    listTeams(),
  ]);
  const names = Object.fromEntries(teams.map((t) => [t.id, t.name]));
  // Standings are only worth computing when a match is actually on screen —
  // the standings screen fetches its own, and this endpoint is polled every
  // second.
  const ranks = match && state.phase !== 'standings'
    ? await rankMap(match.phase, teams.map((t) => t.id))
    : {};
  return NextResponse.json(buildDisplayPayload(state, match, names, ranks));
}
