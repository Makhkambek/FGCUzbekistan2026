import { describe, it, expect } from 'vitest';
import { buildDisplayPayload } from '@/lib/display';
import type { DisplayState } from '@/lib/display';
import type { MatchRow } from '@/lib/db/matches';

/**
 * From 4 September 2026 a playoff alliance is two robots, not three. The
 * third slot of a playoff match row is empty, and nothing on any screen
 * should invent a team for it.
 */
function playoffRow(over: Record<string, unknown> = {}): MatchRow {
  return {
    id: 1, match_number: 1, phase: 'playoff',
    red_alliance_id: 1, blue_alliance_id: 2,
    red1_id: 1, red2_id: 2, red3_id: null,
    blue1_id: 3, blue2_id: 4, blue3_id: null,
    played: 1,
    suppression_red: 100, suppression_blue: 50, extinguisher: 0,
    climb_red1: 'none', climb_red2: 'none', climb_red3: 'none',
    climb_blue1: 'none', climb_blue2: 'none', climb_blue3: 'none',
    partner_climb_red: 0, partner_climb_blue: 0,
    minor_fouls_red: 0, major_fouls_red: 0, minor_fouls_blue: 0, major_fouls_blue: 0,
    card_red1: 'none', card_red2: 'none', card_red3: 'none',
    card_blue1: 'none', card_blue2: 'none', card_blue3: 'none',
    ...over,
  } as unknown as MatchRow;
}

const names = { 1: 'Tashkent', 2: 'Samarkand', 3: 'Bukhara', 4: 'Khiva' };
const state: DisplayState = {
  phase: 'live', matchId: 1, skillsAttemptId: null, startedAt: null, serverNow: 0,
};

describe('a playoff alliance of two robots', () => {
  it('puts two names on the projector, not two and a dash', () => {
    const p = buildDisplayPayload(state, playoffRow(), names) as { red: { teams: string[] } };
    expect(p.red.teams).toEqual(['Tashkent', 'Samarkand']);
  });

  it('does the same for the other alliance', () => {
    const p = buildDisplayPayload(state, playoffRow(), names) as { blue: { teams: string[] } };
    expect(p.blue.teams).toEqual(['Bukhara', 'Khiva']);
  });

  it('keeps a rank beside each of the two, and no third rank', () => {
    const p = buildDisplayPayload(state, playoffRow(), names, { 1: 2, 2: 2 }) as { red: { ranks: (number | null)[] } };
    expect(p.red.ranks).toEqual([2, 2]);
  });

  // Qualification became two robots a side on 5 September 2026 as well, but a
  // row generated before that still names three teams and must still be shown
  // as it was played.
  it('still shows three names in a match generated under the old rules', () => {
    const row = playoffRow({ phase: 'qualification', red3_id: 3, blue3_id: 4, red_alliance_id: null, blue_alliance_id: null });
    const p = buildDisplayPayload(state, row, names) as { red: { teams: string[] } };
    expect(p.red.teams).toEqual(['Tashkent', 'Samarkand', 'Bukhara']);
  });
});
