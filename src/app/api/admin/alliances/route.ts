import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSessionApi } from '@/lib/auth/require-session';
import { getAlliances, saveAlliances, mutateAlliances } from '@/lib/db/alliances';
import type { AllianceRow } from '@/lib/db/alliances';
import { listTeams } from '@/lib/db/teams';
import { listMatches } from '@/lib/db/matches';
import { standingsFromRows } from '@/lib/standings';
import { initialSelection, setPick, clearPick, NotEnoughTeamsError, MIN_TEAMS } from '@/lib/alliances/selection';
import { qualificationBlockReason } from '@/lib/alliances/readiness';
import type { SelectionState, PickSlot } from '@/lib/alliances/selection';

const pickSchema = z.object({
  allianceSeed: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  slotIndex: z.literal(0),
  teamId: z.number().int().positive(),
});

function unauthorized() {
  return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
}

function notEnoughTeams(rankedCount: number) {
  return NextResponse.json(
    {
      error:
        `Three alliances of three teams need at least ${MIN_TEAMS} teams, ` +
        `only ${rankedCount} are available`,
    },
    { status: 400 },
  );
}

// Both mutating alliance actions (a pick, a slot clear, or a full reset) need
// this: saveAlliances always deletes and re-inserts every alliance row, so
// the ids change every time. A playoff match stores red_alliance_id /
// blue_alliance_id pointing at the CURRENT rows — even one unplayed playoff
// match would be left pointing at alliance ids that no longer exist once
// those rows are replaced underneath it.
async function playoffLockError(): Promise<ReturnType<typeof NextResponse.json> | null> {
  const playoffMatches = await listMatches('playoff');
  if (playoffMatches.length === 0) return null;
  return NextResponse.json(
    { error: 'Playoff matches already exist — the alliance selection is locked' },
    { status: 409 },
  );
}

/**
 * Refuses a pick while qualification is unfinished. Clearing a slot and the
 * full reset stay allowed: those only ever undo, and blocking them would trap
 * an operator who seated a draft by mistake.
 */
async function qualificationNotReady(): Promise<ReturnType<typeof NextResponse.json> | null> {
  const qualMatches = await listMatches('qualification');
  const reason = qualificationBlockReason({
    total: qualMatches.length,
    played: qualMatches.filter((m) => m.played).length,
  });
  return reason ? NextResponse.json({ error: reason }, { status: 409 }) : null;
}

async function rankedTeamIds(): Promise<number[]> {
  const [teams, rows] = await Promise.all([listTeams(), listMatches('qualification')]);
  return standingsFromRows(teams.map((t) => t.id), rows).map((s) => s.teamId);
}

// Always re-reads alliances from the database — never cache this across
// requests. A double-submitted pick must see the previous pick's write,
// otherwise the same team could be seated twice.
function stateFromRows(rows: AllianceRow[], ranked: number[]): SelectionState {
  if (rows.length === 0) return initialSelection(ranked);
  return rows.map((r) => ({
    seed: r.seed,
    captain: r.captain_team_id,
    // pick2 is left over from the three-team alliance and is no longer read
    // or written: an alliance is a captain and one team.
    picks: [r.pick1_team_id] as [PickSlot],
  }));
}

async function currentState(ranked: number[]): Promise<SelectionState> {
  return stateFromRows(await getAlliances(), ranked);
}

export async function GET() {
  if (!await requireSessionApi()) return unauthorized();

  const ranked = await rankedTeamIds();
  const qualMatches = await listMatches('qualification');
  const notReadyReason = qualificationBlockReason({
    total: qualMatches.length,
    played: qualMatches.filter((m) => m.played).length,
  });
  try {
    const state = await currentState(ranked);
    return NextResponse.json({ state, ranked, notReadyReason });
  } catch {
    // initialSelection throws when fewer than MIN_TEAMS teams exist —
    // expected early in the tournament, must not surface as a 500.
    return notEnoughTeams(ranked.length);
  }
}

export async function POST(req: NextRequest) {
  if (!await requireSessionApi()) return unauthorized();

  const lockError = await playoffLockError();
  if (lockError) return lockError;

  const notReady = await qualificationNotReady();
  if (notReady) return notReady;

  const parsed = pickSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  const ranked = await rankedTeamIds();
  try {
    // Read and write inside one locked transaction: a pick made on another
    // referee's laptop at the same moment must be visible here, otherwise
    // this request would rewrite the whole table without it.
    const next = await mutateAlliances((rows) =>
      setPick(stateFromRows(rows, ranked), ranked,
        parsed.data.allianceSeed, parsed.data.slotIndex, parsed.data.teamId));
    return NextResponse.json({ state: next });
  } catch (e) {
    if (e instanceof NotEnoughTeamsError) return notEnoughTeams(ranked.length);
    // A rejected pick is the operator's problem (400); anything else is the
    // database's, and saying "not enough teams" for a lock timeout would send
    // the referee hunting for a problem that does not exist.
    if (e instanceof RangeError || e instanceof TypeError) throw e;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Pick failed' }, { status: 400 });
  }
}

const clearSchema = z.object({
  seed: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  slot: z.literal(0),
});

export async function DELETE(req: NextRequest) {
  if (!await requireSessionApi()) return unauthorized();

  const lockError = await playoffLockError();
  if (lockError) return lockError;

  const url = new URL(req.url);
  if (url.searchParams.has('seed') || url.searchParams.has('slot')) {
    // Clear a single pick slot — leaves the rest of the selection untouched.
    const parsed = clearSchema.safeParse({
      seed: Number(url.searchParams.get('seed')),
      slot: Number(url.searchParams.get('slot')),
    });
    if (!parsed.success) return NextResponse.json({ error: 'Invalid seed or slot' }, { status: 400 });

    const ranked = await rankedTeamIds();
    try {
      const next = await mutateAlliances((rows) =>
        clearPick(stateFromRows(rows, ranked), parsed.data.seed, parsed.data.slot));
      return NextResponse.json({ state: next });
    } catch (e) {
      if (e instanceof NotEnoughTeamsError) return notEnoughTeams(ranked.length);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Could not clear the pick' }, { status: 500 });
    }
  }

  // No params: full reset back to captains-only.
  const ranked = await rankedTeamIds();
  try {
    await saveAlliances(initialSelection(ranked));
  } catch (e) {
    if (e instanceof NotEnoughTeamsError) return notEnoughTeams(ranked.length);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not reset the selection' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
