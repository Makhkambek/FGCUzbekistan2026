import { NextRequest, NextResponse } from 'next/server';
import { requireSessionApi } from '@/lib/auth/require-session';
import { listTeams } from '@/lib/db/teams';
import { insertMatches, deleteMatchesByPhase, listMatches } from '@/lib/db/matches';
import { generateSchedule } from '@/lib/schedule/generate';
import { scheduleParamsSchema } from '@/lib/validation';

export async function POST(req: NextRequest) {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Нет доступа' }, { status: 401 });

  const parsed = scheduleParamsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Некорректные параметры' }, { status: 400 });

  const existing = await listMatches('qualification');
  if (existing.some((m) => m.played)) {
    return NextResponse.json(
      { error: 'Есть сыгранные матчи — расписание пересоздать нельзя' }, { status: 409 });
  }

  const teams = await listTeams();
  if (teams.length < 6) {
    return NextResponse.json({ error: 'Нужно минимум 6 команд' }, { status: 400 });
  }

  const schedule = generateSchedule(
    teams.map((t) => t.id), parsed.data.matchesPerTeam, parsed.data.seed);

  await deleteMatchesByPhase('qualification');
  await insertMatches(schedule.map((m) => ({
    matchNumber: m.matchNumber, phase: 'qualification' as const,
    // generateSchedule always produces exactly 3 ids per side; insertMatches
    // re-checks this at runtime, so the assertion here is safe.
    red: m.red as [number, number, number], blue: m.blue as [number, number, number],
  })));

  return NextResponse.json({ ok: true, matches: schedule.length });
}
