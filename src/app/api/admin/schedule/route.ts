import { NextRequest, NextResponse } from 'next/server';
import { requireSessionApi } from '@/lib/auth/require-session';
import { listTeams } from '@/lib/db/teams';
import { insertMatches, listMatches, deleteMatchesByPhase } from '@/lib/db/matches';
import { getAlliances } from '@/lib/db/alliances';
import { generateSchedule } from '@/lib/schedule/generate';
import { scheduleParamsSchema } from '@/lib/validation';
import { scheduleResetBlockReason } from '@/lib/schedule/guards';

export async function POST(req: NextRequest) {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

  const parsed = scheduleParamsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });

  const existing = await listMatches('qualification');
  if (existing.some((m) => m.played)) {
    return NextResponse.json(
      { error: 'Some matches have been played — the schedule cannot be regenerated' }, { status: 409 });
  }

  const teams = await listTeams();
  if (teams.length < 6) {
    return NextResponse.json({ error: 'At least 6 teams are required' }, { status: 400 });
  }

  const schedule = generateSchedule(
    teams.map((t) => t.id), parsed.data.matchesPerTeam, parsed.data.seed);

  // Clear and insert inside one transaction (see insertMatches) so a failed
  // insert can't leave the qualification phase with no matches at all.
  await insertMatches(schedule.map((m) => ({
    matchNumber: m.matchNumber, phase: 'qualification' as const,
    // generateSchedule always produces exactly 3 ids per side; insertMatches
    // re-checks this at runtime, so the assertion here is safe.
    red: m.red as [number, number, number], blue: m.blue as [number, number, number],
  })), { clearPhase: 'qualification' });

  return NextResponse.json({ ok: true, matches: schedule.length });
}

export async function DELETE() {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

  // Alliance picks and the playoff bracket are both derived from the
  // qualification standings — wiping qualification matches out from under
  // them would leave a bracket that no longer matches any real ranking. And
  // the results themselves are unrecoverable, so a played match blocks the
  // reset outright, exactly as it blocks regeneration in POST above.
  const [alliances, playoffMatches, qualMatches] = await Promise.all([
    getAlliances(), listMatches('playoff'), listMatches('qualification'),
  ]);
  const blocked = scheduleResetBlockReason({
    hasPlayedMatches: qualMatches.some((m) => m.played),
    hasAlliances: alliances.length > 0,
    hasPlayoffMatches: playoffMatches.length > 0,
  });
  if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });

  await deleteMatchesByPhase('qualification');
  return NextResponse.json({ ok: true });
}
