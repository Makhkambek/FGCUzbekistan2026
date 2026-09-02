import { NextRequest, NextResponse } from 'next/server';
import { requireSessionApi } from '@/lib/auth/require-session';
import { listTeams, createTeam, deleteTeam } from '@/lib/db/teams';
import { teamAppearsInMatches } from '@/lib/db/matches';
import { teamSchema } from '@/lib/validation';

export async function GET() {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Нет доступа' }, { status: 401 });
  return NextResponse.json(await listTeams());
}

export async function POST(req: NextRequest) {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Нет доступа' }, { status: 401 });
  const parsed = teamSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 });
  await createTeam(parsed.data.name, parsed.data.region);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Нет доступа' }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Некорректный id' }, { status: 400 });
  }
  // Matches has no FK to teams — deleting a team that already appears in a
  // match would orphan those rows and break the scoreboard display.
  if (await teamAppearsInMatches(id)) {
    return NextResponse.json(
      { error: 'Нельзя удалить команду — она уже участвует в расписании матчей' },
      { status: 409 });
  }
  await deleteTeam(id);
  return NextResponse.json({ ok: true });
}
