import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSessionApi } from '@/lib/auth/require-session';
import { getAlliances, saveAlliances } from '@/lib/db/alliances';
import { listTeams } from '@/lib/db/teams';
import { listMatches } from '@/lib/db/matches';
import { standingsFromRows } from '@/lib/standings';
import { initialSelection, applyPick } from '@/lib/alliances/selection';
import type { SelectionState } from '@/lib/alliances/selection';

const pickSchema = z.object({ teamId: z.number().int().positive() });

const MIN_TEAMS = 9;

function unauthorized() {
  return NextResponse.json({ error: 'Нет доступа' }, { status: 401 });
}

function notEnoughTeams(rankedCount: number) {
  return NextResponse.json(
    {
      error:
        `Для трёх альянсов по три команды нужно минимум ${MIN_TEAMS} команд, ` +
        `сейчас доступно ${rankedCount}`,
    },
    { status: 400 },
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
    picks: [r.pick1_team_id, r.pick2_team_id].filter((x): x is number => x !== null),
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

  const parsed = pickSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 });

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
    const next = applyPick(state, ranked, parsed.data.teamId);
    await saveAlliances(next);
    return NextResponse.json({ state: next });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Ошибка выбора' }, { status: 400 });
  }
}

export async function DELETE() {
  if (!await requireSessionApi()) return unauthorized();

  const ranked = await rankedTeamIds();
  try {
    await saveAlliances(initialSelection(ranked));
  } catch {
    return notEnoughTeams(ranked.length);
  }
  return NextResponse.json({ ok: true });
}
