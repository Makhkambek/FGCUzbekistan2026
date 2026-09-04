import { NextRequest, NextResponse } from 'next/server';
import { requireSessionApi } from '@/lib/auth/require-session';
import { listAttempts, replaceAttempts, attemptScore } from '@/lib/db/skills';
import { listTeams } from '@/lib/db/teams';
import { skillsScheduleSchema } from '@/lib/validation';

export async function GET() {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

  const [attempts, teams] = await Promise.all([listAttempts(), listTeams()]);
  const names = Object.fromEntries(teams.map((t) => [t.id, t.name]));
  return NextResponse.json({
    attempts: attempts.map((a) => ({
      id: a.id, round: a.round, position: a.position,
      teamId: a.team_id, teamName: names[a.team_id] ?? String(a.team_id),
      alliance: a.alliance, played: !!a.played, score: a.played ? attemptScore(a) : null,
    })),
    teams: teams.map((t) => ({ id: t.id, name: t.name })),
  });
}

/** Builds the running order: every team's first attempt, then every team's second. */
export async function POST(req: NextRequest) {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

  const parsed = skillsScheduleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });

  const teams = await listTeams();
  const known = new Set(teams.map((t) => t.id));
  const unknown = parsed.data.teamIds.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    return NextResponse.json({ error: 'Some of those teams do not exist' }, { status: 400 });
  }
  if (new Set(parsed.data.teamIds).size !== parsed.data.teamIds.length) {
    return NextResponse.json({ error: 'The same team is listed twice' }, { status: 400 });
  }

  try {
    const created = await replaceAttempts(
      parsed.data.teamIds, parsed.data.attemptsPerTeam, parsed.data.alliance);
    return NextResponse.json({ ok: true, attempts: created });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not build the skills order' }, { status: 409 });
  }
}
