import { describe, it, expect } from 'vitest';
import { buildDisplayPayload } from '@/lib/display';

const row = (over: Partial<any> = {}) => ({
  id: 1, match_number: 3, phase: 'qualification',
  red_alliance_id: null, blue_alliance_id: null,
  red1_id: 1, red2_id: 2, red3_id: 3, blue1_id: 4, blue2_id: 5, blue3_id: 6,
  played: 0,
  suppression_red: 0, suppression_blue: 0, extinguisher: 0,
  climb_red1: 'none', climb_red2: 'none', climb_red3: 'none',
  climb_blue1: 'none', climb_blue2: 'none', climb_blue3: 'none',
  partner_climb_red: 0, partner_climb_blue: 0,
  minor_fouls_red: 0, major_fouls_red: 0, minor_fouls_blue: 0, major_fouls_blue: 0,
  card_red1: 'none', card_red2: 'none', card_red3: 'none',
  card_blue1: 'none', card_blue2: 'none', card_blue3: 'none',
  ...over,
}) as any;

const teamNames = { 1: 'Alpha', 2: 'Bravo', 3: 'Charlie', 4: 'Delta', 5: 'Echo', 6: 'Foxtrot' };

describe('buildDisplayPayload — standings', () => {
  it('фаза standings отдаётся как есть, независимо от матча', () => {
    const p = buildDisplayPayload({ phase: 'standings', matchId: null }, null, teamNames);
    expect(p).toEqual({ phase: 'standings' });
  });
});

describe('buildDisplayPayload — live', () => {
  it('возвращает состав red/blue альянсов по именам команд', () => {
    const p = buildDisplayPayload({ phase: 'live', matchId: 1 }, row(), teamNames);
    expect(p.phase).toBe('live');
    if (p.phase !== 'live') throw new Error('unreachable');
    expect(p.matchNumber).toBe(3);
    expect(p.matchPhase).toBe('qualification');
    expect(p.red.teams).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(p.blue.teams).toEqual(['Delta', 'Echo', 'Foxtrot']);
  });

  it('незнакомый id команды подставляется как —', () => {
    const p = buildDisplayPayload({ phase: 'live', matchId: 1 }, row(), { 1: 'Alpha' });
    if (p.phase !== 'live') throw new Error('unreachable');
    expect(p.red.teams).toEqual(['Alpha', '—', '—']);
  });

  it('если матч не найден (устаревший matchId) — откат на standings', () => {
    const p = buildDisplayPayload({ phase: 'live', matchId: 999 }, null, teamNames);
    expect(p).toEqual({ phase: 'standings' });
  });
});

describe('buildDisplayPayload — result', () => {
  it('красные выигрывают — winner red, счёт посчитан', () => {
    const p = buildDisplayPayload(
      { phase: 'result', matchId: 1 },
      row({ suppression_red: 100, suppression_blue: 50 }),
      teamNames,
    );
    expect(p.phase).toBe('result');
    if (p.phase !== 'result') throw new Error('unreachable');
    expect(p.winner).toBe('red');
    expect(p.red.score).toBeGreaterThan(p.blue.score);
    expect(p.red.teams).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('синие выигрывают — winner blue', () => {
    const p = buildDisplayPayload(
      { phase: 'result', matchId: 1 },
      row({ suppression_red: 20, suppression_blue: 120 }),
      teamNames,
    );
    if (p.phase !== 'result') throw new Error('unreachable');
    expect(p.winner).toBe('blue');
  });

  it('равный счёт — winner tie', () => {
    const p = buildDisplayPayload(
      { phase: 'result', matchId: 1 },
      row({ suppression_red: 40, suppression_blue: 40 }),
      teamNames,
    );
    if (p.phase !== 'result') throw new Error('unreachable');
    expect(p.winner).toBe('tie');
    expect(p.red.score).toBe(p.blue.score);
  });

  it('если матч не найден — откат на standings', () => {
    const p = buildDisplayPayload({ phase: 'result', matchId: 999 }, null, teamNames);
    expect(p).toEqual({ phase: 'standings' });
  });

  it('содержит разбивку по категориям манула 2026 года (suppression/multiplier/partner climbs)', () => {
    const p = buildDisplayPayload(
      { phase: 'result', matchId: 1 },
      row({
        suppression_red: 100, suppression_blue: 50, extinguisher: 30,
        climb_red1: 'zone2', climb_red2: 'zone1',
        partner_climb_red: 1,
      }),
      teamNames,
    );
    if (p.phase !== 'result') throw new Error('unreachable');
    expect(p.red.suppression).toBe(100);
    expect(p.red.multiplier).toBeCloseTo(1.30);
    expect(p.red.partnerClimbPoints).toBe(25);
    expect(p.blue.partnerClimbPoints).toBe(0);
    expect(p.extinguisher).toBe(30);
    expect(p.coopertition).toBe(0);
  });

  it('penalty — это фактически добавленные сопернику очки за фолы, а не вычет у нарушителя', () => {
    const p = buildDisplayPayload(
      { phase: 'result', matchId: 1 },
      row({ suppression_red: 100, suppression_blue: 100, minor_fouls_blue: 1 }),
      teamNames,
    );
    if (p.phase !== 'result') throw new Error('unreachable');
    expect(p.red.penalty).toBeGreaterThan(0);
    expect(p.blue.penalty).toBe(0);
    expect(p.red.score).toBe(100 + p.red.penalty);
  });
});
