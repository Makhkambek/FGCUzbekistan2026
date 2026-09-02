import { NextResponse } from 'next/server';
import { requireSessionApi } from '@/lib/auth/require-session';
import { getAlliances } from '@/lib/db/alliances';
import { insertMatches } from '@/lib/db/matches';
import { PLAYOFF_PAIRINGS } from '@/lib/alliances/playoff';

export async function POST() {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Нет доступа' }, { status: 401 });

  const alliances = await getAlliances();
  if (alliances.length !== 3 || alliances.some((a) => !a.pick1_team_id || !a.pick2_team_id)) {
    return NextResponse.json(
      { error: 'Сначала нужно полностью укомплектовать три альянса' }, { status: 400 });
  }

  const bySeed = new Map(alliances.map((a) => [a.seed, a]));
  const teamsOf = (seed: number): [number, number, number] => {
    const a = bySeed.get(seed);
    if (!a || !a.pick1_team_id || !a.pick2_team_id) {
      throw new Error(`Альянс с номером ${seed} не найден или не укомплектован`);
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
      { error: e instanceof Error ? e.message : 'Не удалось создать матчи плей-оффа' },
      { status: 400 });
  }

  return NextResponse.json({ ok: true, matches: PLAYOFF_PAIRINGS.length });
}
