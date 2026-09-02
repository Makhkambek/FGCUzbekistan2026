import { describe, it, expect } from 'vitest';
import { matchRowToInput, standingsFromRows } from '@/lib/standings';

const row = (over: Partial<any> = {}) => ({
  id: 1, match_number: 1, phase: 'qualification',
  red_alliance_id: null, blue_alliance_id: null,
  red1_id: 1, red2_id: 2, red3_id: 3, blue1_id: 4, blue2_id: 5, blue3_id: 6,
  played: 1,
  suppression_red: 100, suppression_blue: 50, extinguisher: 0,
  climb_red1: 'none', climb_red2: 'none', climb_red3: 'none',
  climb_blue1: 'none', climb_blue2: 'none', climb_blue3: 'none',
  partner_climb_red: 0, partner_climb_blue: 0,
  minor_fouls_red: 0, major_fouls_red: 0, minor_fouls_blue: 0, major_fouls_blue: 0,
  card_red1: 'none', card_red2: 'none', card_red3: 'none',
  card_blue1: 'none', card_blue2: 'none', card_blue3: 'none',
  ...over,
}) as any;

describe('matchRowToInput', () => {
  it('переносит поля строки БД в вход подсчёта', () => {
    const input = matchRowToInput(row({ suppression_red: 42, climb_red1: 'zone2' }));
    expect(input.red.suppression).toBe(42);
    expect(input.red.climbs[0]).toBe('zone2');
  });
});

describe('standingsFromRows', () => {
  it('несыгранные матчи не учитываются', () => {
    const s = standingsFromRows([1, 2, 3, 4, 5, 6], [row({ played: 0 })]);
    expect(s.every((x) => x.played === 0)).toBe(true);
  });

  it('красные получают свой балл, синие — свой', () => {
    const s = standingsFromRows([1, 2, 3, 4, 5, 6], [row()]);
    expect(s.find((x) => x.teamId === 1)!.rankingScore).toBe(100);
    expect(s.find((x) => x.teamId === 4)!.rankingScore).toBe(50);
  });

  it('команда с white card получает ноль за матч', () => {
    const s = standingsFromRows([1, 2, 3, 4, 5, 6], [row({ card_red1: 'white' })]);
    expect(s.find((x) => x.teamId === 1)!.rankingScore).toBe(0);
    expect(s.find((x) => x.teamId === 2)!.rankingScore).toBe(100);
  });

  it('красная карточка помечает матч как невыкидываемый', () => {
    const rows = [row({ id: 1, match_number: 1, card_red1: 'red' }),
                  row({ id: 2, match_number: 2, suppression_red: 10 })];
    const s = standingsFromRows([1, 2, 3, 4, 5, 6], rows);
    // Матч 1 = 0 (красная, выкинуть нельзя), матч 2 = 10 → выкидываем матч 2
    expect(s.find((x) => x.teamId === 1)!.rankingScore).toBe(0);
  });
});
