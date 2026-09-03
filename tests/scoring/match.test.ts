import { describe, it, expect } from 'vitest';
import {
  ceilDiv, climbMultiplierHundredths, coopertitionBonus,
  alliancePreScore, computeMatchScores,
} from '@/lib/scoring/match';
import type { AllianceInput } from '@/lib/scoring/types';

const alliance = (over: Partial<AllianceInput> = {}): AllianceInput => ({
  suppression: 0, climbs: ['none', 'none', 'none'],
  partnerClimbs: 0, minorFouls: 0, majorFouls: 0, ...over,
});

describe('ceilDiv', () => {
  it('делит нацело без остатка', () => expect(ceilDiv(1300, 100)).toBe(13));
  it('округляет вверх при остатке', () => expect(ceilDiv(1301, 100)).toBe(14));
});

describe('climbMultiplierHundredths', () => {
  it('без залезаний множитель 1.00', () =>
    expect(climbMultiplierHundredths(['none', 'none', 'none'])).toBe(100));
  it('складывает инкременты по мануалу', () =>
    expect(climbMultiplierHundredths(['zone3', 'zone2', 'contact'])).toBe(155));
  it('максимум при трёх zone3', () =>
    expect(climbMultiplierHundredths(['zone3', 'zone3', 'zone3'])).toBe(190));
});

describe('coopertitionBonus', () => {
  const z = (n: number) => Array.from({ length: 6 }, (_, i) => (i < n ? 'zone3' : 'none')) as any;
  it('меньше четырёх — ноль', () => expect(coopertitionBonus(z(3))).toBe(0));
  it('четыре — 10', () => expect(coopertitionBonus(z(4))).toBe(10));
  it('пять — 25', () => expect(coopertitionBonus(z(5))).toBe(25));
  it('шесть — 40', () => expect(coopertitionBonus(z(6))).toBe(40));
});

describe('alliancePreScore', () => {
  it('умножает suppression на множитель и округляет вверх', () => {
    // 33 × 1.15 = 37.95 → 38
    const a = alliance({ suppression: 33, climbs: ['zone1', 'contact', 'none'] });
    expect(alliancePreScore(a, 0, 0)).toBe(38);
  });

  it('не округляет вверх целый результат (защита от ошибки float)', () => {
    // 10 × 1.30 = ровно 13. Наивный float даёт 13.000000000000002 → 14.
    const a = alliance({ suppression: 10, climbs: ['zone1', 'zone2', 'none'] });
    expect(alliancePreScore(a, 0, 0)).toBe(13);
  });

  it('добавляет partner climb, extinguisher и coopertition', () => {
    const a = alliance({ suppression: 100, climbs: ['zone3', 'zone2', 'contact'], partnerClimbs: 2 });
    // ceil(100 × 1.55) = 155, +25×2 = 50, +40 extinguisher, +10 coopertition
    expect(alliancePreScore(a, 40, 10)).toBe(255);
  });
});

describe('computeMatchScores', () => {
  it('даёт обоим альянсам одинаковые extinguisher и coopertition', () => {
    const r = computeMatchScores({
      extinguisher: 30,
      red: alliance({ suppression: 0, climbs: ['zone3', 'zone3', 'zone3'] }),
      blue: alliance({ suppression: 0, climbs: ['zone3', 'none', 'none'] }),
    });
    expect(r.coopertition).toBe(10); // четыре робота в zone3 из шести
    expect(r.red).toBe(40);  // 0 + 30 + 10
    expect(r.blue).toBe(40); // 0 + 30 + 10
  });

  it('начисляет штраф сопернику, а не вычитает у нарушителя', () => {
    const r = computeMatchScores({
      extinguisher: 0,
      red: alliance({ suppression: 100 }),
      blue: alliance({ suppression: 200, minorFouls: 1 }),
    });
    expect(r.bluePre).toBe(200);
    expect(r.blue).toBe(200);        // у нарушителя не отнимаем
    expect(r.red).toBe(100 + 10);    // ceil(0.05 × 200) = 10 уходит красным
  });

  it('накапливает несколько фолов', () => {
    const r = computeMatchScores({
      extinguisher: 0,
      red: alliance({ suppression: 0 }),
      blue: alliance({ suppression: 100, minorFouls: 2, majorFouls: 1 }),
    });
    // 2 × ceil(0.05×100)=5 → 10, плюс 1 × ceil(0.10×100)=10 → всего 20
    expect(r.red).toBe(20);
  });

  it('округляет суммарный штраф один раз, а не каждый фол отдельно', () => {
    const r = computeMatchScores({
      extinguisher: 0,
      red: alliance({ suppression: 0 }),
      blue: alliance({ suppression: 21, minorFouls: 3 }),
    });
    // Мануал: «Multiple MINOR FOULS … are cumulative», «All fractional MATCH
    // scores round up to the nearest whole number» → 3 фола = 15% от 21 = 3.15
    // → округление вверх ОДИН раз = 4. Не 3 × ceil(1.05) = 6.
    expect(r.bluePre).toBe(21);
    expect(r.red).toBe(4);
  });

  it('складывает проценты minor и major до округления', () => {
    const r = computeMatchScores({
      extinguisher: 0,
      red: alliance({ suppression: 0 }),
      blue: alliance({ suppression: 33, minorFouls: 1, majorFouls: 1 }),
    });
    // 5% + 10% = 15% от 33 = 4.95 → 5. Не ceil(1.65) + ceil(3.3) = 2 + 4 = 6.
    expect(r.red).toBe(5);
  });

  it('без фолов штрафа нет', () => {
    const r = computeMatchScores({
      extinguisher: 0,
      red: alliance({ suppression: 0 }),
      blue: alliance({ suppression: 21 }),
    });
    expect(r.red).toBe(0);
  });

  it('считает процент штрафа от балла ДО штрафов', () => {
    const r = computeMatchScores({
      extinguisher: 0,
      red: alliance({ suppression: 100, minorFouls: 1 }),
      blue: alliance({ suppression: 100, minorFouls: 1 }),
    });
    // оба pre = 100, каждый получает ceil(0.05×100)=5 от соперника
    expect(r.red).toBe(105);
    expect(r.blue).toBe(105);
  });
});
