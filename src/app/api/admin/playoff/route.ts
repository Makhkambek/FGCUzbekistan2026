import { NextResponse } from 'next/server';
import { requireSessionApi } from '@/lib/auth/require-session';
import { getAlliances } from '@/lib/db/alliances';
import { insertMatches, listMatches } from '@/lib/db/matches';
import { PLAYOFF_PAIRINGS } from '@/lib/alliances/playoff';
import { qualificationBlockReason } from '@/lib/alliances/readiness';

export async function GET() {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

  const matches = await listMatches('playoff');
  return NextResponse.json({ matches: matches.length, played: matches.filter((m) => m.played).length });
}

export async function POST() {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

  // Same guard shape as /api/admin/schedule: once a match has a real result,
  // regenerating the phase would silently erase it with no way back. This
  // check must live here, not just in the UI — a confirmation dialog gets
  // clicked through under pressure during a live ceremony.
  const existingPlayoff = await listMatches('playoff');
  if (existingPlayoff.some((m) => m.played)) {
    return NextResponse.json(
      { error: 'Some playoff matches have been played — the bracket cannot be rebuilt' }, { status: 409 });
  }

  // The bracket is built from alliances, which are built from the final
  // qualification ranking. Building it early would freeze the event on a
  // ranking that has not happened yet, and there is no clean way back.
  const qualMatches = await listMatches('qualification');
  const notReady = qualificationBlockReason({
    total: qualMatches.length,
    played: qualMatches.filter((m) => m.played).length,
  });
  if (notReady) return NextResponse.json({ error: notReady }, { status: 409 });

  const alliances = await getAlliances();
  if (alliances.length !== 3 || alliances.some((a) => !a.pick1_team_id || !a.pick2_team_id)) {
    return NextResponse.json(
      { error: 'All three alliances must be complete first' }, { status: 400 });
  }

  const bySeed = new Map(alliances.map((a) => [a.seed, a]));
  const teamsOf = (seed: number): [number, number, number] => {
    const a = bySeed.get(seed);
    if (!a || !a.pick1_team_id || !a.pick2_team_id) {
      throw new Error(`Alliance ${seed} was not found or is incomplete`);
    }
    return [a.captain_team_id, a.pick1_team_id, a.pick2_team_id];
  };

  try {
    // clearPhase runs the delete inside the same transaction as the insert
    // (see insertMatches), so a failure here rolls back to the previous
    // playoff matches instead of leaving the phase empty.
    await insertMatches(PLAYOFF_PAIRINGS.map((p) => ({
      matchNumber: p.matchNumber, phase: 'playoff' as const,
      red: teamsOf(p.redSeed), blue: teamsOf(p.blueSeed),
      redAllianceId: bySeed.get(p.redSeed)!.id, blueAllianceId: bySeed.get(p.blueSeed)!.id,
    })), { clearPhase: 'playoff' });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not create playoff matches' },
      { status: 400 });
  }

  return NextResponse.json({ ok: true, matches: PLAYOFF_PAIRINGS.length });
}
