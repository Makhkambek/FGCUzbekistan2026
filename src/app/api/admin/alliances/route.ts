import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSessionApi } from '@/lib/auth/require-session';
import { getAlliances, saveAlliances } from '@/lib/db/alliances';
import { listTeams } from '@/lib/db/teams';
import { listMatches } from '@/lib/db/matches';
import { standingsFromRows } from '@/lib/standings';
import { initialSelection, setPick, clearPick } from '@/lib/alliances/selection';
import type { SelectionState, PickSlot } from '@/lib/alliances/selection';

const pickSchema = z.object({
  allianceSeed: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  slotIndex: z.union([z.literal(0), z.literal(1)]),
  teamId: z.number().int().positive(),
});

const MIN_TEAMS = 9;

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

async function rankedTeamIds(): Promise<number[]> {
  const [teams, rows] = await Promise.all([listTeams(), listMatches('qualification')]);
  return standingsFromRows(teams.map((t) => t.id), rows).map((s) => s.teamId);
}

// Always re-reads alliances from the database — never cache this across
// requests. A double-submitted pick must see the previous pick's write,
// otherwise the same team could be seated twice.
async function currentState(ranked: number[]): Promise<SelectionState> {
  const rows = await getAlliances();
  if (rows.length === 0) return initialSelection(ranked);
  return rows.map((r) => ({
    seed: r.seed,
    captain: r.captain_team_id,
    picks: [r.pick1_team_id, r.pick2_team_id] as [PickSlot, PickSlot],
  }));
}

export async function GET() {
  if (!await requireSessionApi()) return unauthorized();

  const ranked = await rankedTeamIds();
  try {
    const state = await currentState(ranked);
    return NextResponse.json({ state, ranked });
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

  const parsed = pickSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  const ranked = await rankedTeamIds();
  let state: SelectionState;
  try {
    // Fresh read on every request: this is what makes a double-submitted
    // pick safe. If it were derived from anything cached, the second of two
    // quick clicks could seat the same team twice.
    state = await currentState(ranked);
  } catch {
    return notEnoughTeams(ranked.length);
  }

  try {
    const next = setPick(state, ranked, parsed.data.allianceSeed, parsed.data.slotIndex, parsed.data.teamId);
    await saveAlliances(next);
    return NextResponse.json({ state: next });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Pick failed' }, { status: 400 });
  }
}

const clearSchema = z.object({
  seed: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  slot: z.union([z.literal(0), z.literal(1)]),
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
    let state: SelectionState;
    try {
      state = await currentState(ranked);
    } catch {
      return notEnoughTeams(ranked.length);
    }
    const next = clearPick(state, parsed.data.seed, parsed.data.slot);
    await saveAlliances(next);
    return NextResponse.json({ state: next });
  }

  // No params: full reset back to captains-only.
  const ranked = await rankedTeamIds();
  try {
    await saveAlliances(initialSelection(ranked));
  } catch {
    return notEnoughTeams(ranked.length);
  }
  return NextResponse.json({ ok: true });
}
