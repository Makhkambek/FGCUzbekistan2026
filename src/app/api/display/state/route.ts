import { NextResponse } from 'next/server';
import { getDisplayState } from '@/lib/db/display';
import { getMatchById } from '@/lib/db/matches';
import { listTeams } from '@/lib/db/teams';
import { buildDisplayPayload } from '@/lib/display';

export const dynamic = 'force-dynamic';

export async function GET() {
  const state = await getDisplayState();
  const [match, teams] = await Promise.all([
    state.matchId !== null ? getMatchById(state.matchId) : null,
    listTeams(),
  ]);
  const names = Object.fromEntries(teams.map((t) => [t.id, t.name]));
  return NextResponse.json(buildDisplayPayload(state, match, names));
}
