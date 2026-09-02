import type { AllianceInput, ClimbPosition, MatchInput, MatchScores } from './types';

/** Инкременты множителя в сотых — целые, чтобы не ловить ошибку float. */
export const CLIMB_INCREMENT_HUNDREDTHS: Record<ClimbPosition, number> = {
  none: 0, contact: 5, zone1: 10, zone2: 20, zone3: 30,
};

/** Деление с округлением вверх на целых числах. */
export function ceilDiv(a: number, b: number): number {
  return Math.floor((a + b - 1) / b);
}

export function climbMultiplierHundredths(climbs: ClimbPosition[]): number {
  return 100 + climbs.reduce((acc, c) => acc + CLIMB_INCREMENT_HUNDREDTHS[c], 0);
}

export function coopertitionBonus(allClimbs: ClimbPosition[]): number {
  const zone3 = allClimbs.filter((c) => c === 'zone3').length;
  if (zone3 >= 6) return 40;
  if (zone3 === 5) return 25;
  if (zone3 === 4) return 10;
  return 0;
}

export function alliancePreScore(
  a: AllianceInput, extinguisher: number, coopertition: number,
): number {
  const multH = climbMultiplierHundredths(a.climbs);
  return ceilDiv(a.suppression * multH, 100)
    + 25 * a.partnerClimbs
    + extinguisher
    + coopertition;
}

export function computeMatchScores(m: MatchInput): MatchScores {
  const coopertition = coopertitionBonus([...m.red.climbs, ...m.blue.climbs]);
  const redPre = alliancePreScore(m.red, m.extinguisher, coopertition);
  const bluePre = alliancePreScore(m.blue, m.extinguisher, coopertition);

  const red = redPre
    + m.blue.minorFouls * ceilDiv(bluePre * 5, 100)
    + m.blue.majorFouls * ceilDiv(bluePre * 10, 100);
  const blue = bluePre
    + m.red.minorFouls * ceilDiv(redPre * 5, 100)
    + m.red.majorFouls * ceilDiv(redPre * 10, 100);

  return {
    red, blue, redPre, bluePre, coopertition,
    redMultiplier: climbMultiplierHundredths(m.red.climbs) / 100,
    blueMultiplier: climbMultiplierHundredths(m.blue.climbs) / 100,
  };
}
