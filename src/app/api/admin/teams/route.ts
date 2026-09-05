import { NextRequest, NextResponse } from 'next/server';
import { requireSessionApi } from '@/lib/auth/require-session';
import { listTeams, createTeam, updateTeam, deleteTeam, deleteAllTeams } from '@/lib/db/teams';
import { listMatches } from '@/lib/db/matches';
import type { MatchRow } from '@/lib/db/matches';
import { getAlliances } from '@/lib/db/alliances';
import { listAttempts } from '@/lib/db/skills';
import { teamDeletionBlockReason } from '@/lib/teams/guards';
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

/** Every per-alliance team slot of a match row, third robots included. */
function matchTeamIds(m: MatchRow): number[] {
  return [m.red1_id, m.red2_id, m.red3_id, m.blue1_id, m.blue2_id, m.blue3_id]
    .filter((id): id is number => typeof id === 'number');
}

/**
 * What still references the team(s) about to be deleted.
 *
 * `teamId` undefined means "every team", the delete-all case: then any row at
 * all in one of these tables is a blocker. Alliances and skills attempts are
 * read here too — they hold real foreign keys into `teams`, so skipping them
 * turned the delete into a database-level failure instead of an explanation.
 */
async function deletionState(teamId?: number) {
  const [matches, alliances, attempts] = await Promise.all([
    listMatches(), getAlliances(), listAttempts(),
  ]);
  const inMatch = (m: MatchRow) => teamId === undefined || matchTeamIds(m).includes(teamId);
  return {
    inQualificationMatches: matches.some((m) => m.phase === 'qualification' && inMatch(m)),
    inPlayoffMatches: matches.some((m) => m.phase === 'playoff' && inMatch(m)),
    inAlliances: alliances.some((a) => teamId === undefined
      || a.captain_team_id === teamId || a.pick1_team_id === teamId || a.pick2_team_id === teamId),
    hasSkillsAttempts: attempts.some((a) => teamId === undefined || a.team_id === teamId),
  };
}

export async function DELETE(req: NextRequest) {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  const url = new URL(req.url);

  if (url.searchParams.get('all') === 'true') {
    const blocked = teamDeletionBlockReason(await deletionState(), 'all');
    if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });
    const deleted = await deleteAllTeams();
    return NextResponse.json({ ok: true, deleted });
  }

  const id = Number(url.searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  const blocked = teamDeletionBlockReason(await deletionState(id), 'single');
  if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });
  await deleteTeam(id);
  return NextResponse.json({ ok: true });
}
