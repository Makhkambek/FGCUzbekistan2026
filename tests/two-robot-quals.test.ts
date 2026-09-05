import { describe, it, expect } from 'vitest';
import { maxPartnerClimbs } from '@/lib/scoring/match';
import { matchResultSchema } from '@/lib/validation';
import { buildDisplayPayload } from '@/lib/display';
import type { DisplayState } from '@/lib/display';
import type { MatchRow } from '@/lib/db/matches';

/**
 * From 5 September 2026 a qualification alliance is two robots as well, so
 * every alliance at the event — quals and finals alike — is two.
 */
function qualRow(over: Record<string, unknown> = {}): MatchRow {
  return {
    id: 1, match_number: 1, phase: 'qualification',
    red_alliance_id: null, blue_alliance_id: null,
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

describe('a qualification alliance of two robots', () => {
  it('puts two names on the projector, not two and a dash', () => {
    const p = buildDisplayPayload(state, qualRow(), names) as { red: { teams: string[] } };
    expect(p.red.teams).toEqual(['Tashkent', 'Samarkand']);
  });

  it('does the same for the other alliance', () => {
    const p = buildDisplayPayload(state, qualRow(), names) as { blue: { teams: string[] } };
    expect(p.blue.teams).toEqual(['Bukhara', 'Khiva']);
  });
});

describe('partner climbs', () => {
  // Two robots can lift one partner between them; three could lift two.
  it('two robots may lift one partner', () => {
    expect(maxPartnerClimbs(2)).toBe(1);
  });

  it('three robots may lift two — the old three-a-side rule', () => {
    expect(maxPartnerClimbs(3)).toBe(2);
  });

  it('a lone robot has nobody to lift', () => {
    expect(maxPartnerClimbs(1)).toBe(0);
  });

  const body = (over: Record<string, unknown> = {}) => ({
    suppressionRed: 0, suppressionBlue: 0, extinguisher: 0,
    climbRed: ['none', 'none', 'none'], climbBlue: ['none', 'none', 'none'],
    partnerClimbRed: 0, partnerClimbBlue: 0,
    minorFoulsRed: 0, majorFoulsRed: 0, minorFoulsBlue: 0, majorFoulsBlue: 0,
    cardRed: ['none', 'none', 'none'], cardBlue: ['none', 'none', 'none'],
    ...over,
  });

  it('the API accepts one partner climb', () => {
    expect(matchResultSchema.safeParse(body({ partnerClimbRed: 1 })).success).toBe(true);
  });

  it('the API refuses two — no alliance has a third robot to lift', () => {
    expect(matchResultSchema.safeParse(body({ partnerClimbRed: 2 })).success).toBe(false);
    expect(matchResultSchema.safeParse(body({ partnerClimbBlue: 2 })).success).toBe(false);
  });
});
