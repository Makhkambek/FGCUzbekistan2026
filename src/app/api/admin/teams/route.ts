import { NextRequest, NextResponse } from 'next/server';
import { requireSessionApi } from '@/lib/auth/require-session';
import { listTeams, createTeam, updateTeam, deleteTeam, deleteAllTeams } from '@/lib/db/teams';
import { teamAppearsInMatches, listMatches } from '@/lib/db/matches';
import { teamSchema } from '@/lib/validation';
import { findDuplicateName } from '@/lib/db/team-names';

export async function GET() {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  return NextResponse.json(await listTeams());
}

export async function POST(req: NextRequest) {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  const parsed = teamSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  // Fresh read on every request, so the second of two quick clicks on "Add"
  // sees the team the first one created instead of seating it twice.
  const duplicate = findDuplicateName(
    (await listTeams()).map((t) => t.name), parsed.data.name);
  if (duplicate) {
    return NextResponse.json(
      { error: `A team named "${duplicate}" already exists` }, { status: 409 });
  }

  await createTeam(parsed.data.name, parsed.data.region);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  const parsed = teamSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  // A rename can collide just as a fresh insert can. The team's own current
  // name is excluded, so re-saving a row without touching the name still works
  // (and so does a pure capitalisation fix on that same row).
  const duplicate = findDuplicateName(
    (await listTeams()).filter((t) => t.id !== id).map((t) => t.name), parsed.data.name);
  if (duplicate) {
    return NextResponse.json(
      { error: `A team named "${duplicate}" already exists` }, { status: 409 });
  }

  const updated = await updateTeam(id, parsed.data.name, parsed.data.region);
  if (!updated) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  const url = new URL(req.url);

  if (url.searchParams.get('all') === 'true') {
    // Matches has no FK to teams — wiping every team while any match still
    // references team ids would orphan the whole schedule at once, the same
    // reason the single-team guard below exists.
    if ((await listMatches()).length > 0) {
      return NextResponse.json(
        { error: 'Teams cannot be deleted — matches already reference them. Reset the schedule first.' },
        { status: 409 });
    }
    await deleteAllTeams();
    return NextResponse.json({ ok: true });
  }

  const id = Number(url.searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  // Matches has no FK to teams — deleting a team that already appears in a
  // match would orphan those rows and break the scoreboard display.
  if (await teamAppearsInMatches(id)) {
    return NextResponse.json(
      { error: 'This team cannot be deleted — it is already part of the match schedule' },
      { status: 409 });
  }
  await deleteTeam(id);
  return NextResponse.json({ ok: true });
}
