import type { AllianceInput, ClimbPosition, MatchInput, MatchScores } from './types';

/** Multiplier increments in hundredths — integers, to avoid float error. */
export const CLIMB_INCREMENT_HUNDREDTHS: Record<ClimbPosition, number> = {
  none: 0, contact: 5, zone1: 10, zone2: 20, zone3: 30,
};

/** Integer division rounding up. */
export function ceilDiv(a: number, b: number): number {
  return Math.floor((a + b - 1) / b);
}

export function climbMultiplierHundredths(climbs: ClimbPosition[]): number {
  return 100 + climbs.reduce((acc, c) => acc + CLIMB_INCREMENT_HUNDREDTHS[c], 0);
}

/**
 * The shared bonus for robots that climbed to zone 3, counted across both
 * alliances.
 *
 * The scale moved down with the field on 5 September 2026: an alliance is two
 * robots in every phase now, so four robots take the field and all four in
 * zone 3 is the maximum. On the old six-robot field the steps were 6/5/4 —
 * left as they were, the top two would have been unreachable and the bonus
 * would have been capped at 10 for the whole event.
 */
export function coopertitionBonus(allClimbs: ClimbPosition[]): number {
  const zone3 = allClimbs.filter((c) => c === 'zone3').length;
  if (zone3 >= 4) return 40;
  if (zone3 === 3) return 25;
  if (zone3 === 2) return 10;
  return 0;
}

/**
 * How many partners an alliance of this many robots can lift between them:
 * everyone but the robot doing the lifting. Two robots lift one; three lifted
 * two, back when an alliance was three.
 */
export function maxPartnerClimbs(robotsInAlliance: number): number {
  return Math.max(0, robotsInAlliance - 1);
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

/**
 * Очки, которые соперник получает за фолы этого альянса.
 *
 * Мануал: MINOR FOUL — 5%, MAJOR FOUL — 10% от pre-penalty score; «Multiple
 * MINOR/MAJOR FOULS assessed to a REGIONAL ALLIANCE during a single MATCH are
 * cumulative» (§ определения) и «All fractional MATCH scores round up to the
 * nearest whole number» (§ 4.5). Проценты складываются от одной и той же базы,
 * округление вверх — один раз в конце, а не после каждого фола.
 */
export function foulPenalty(prePenaltyScore: number, offender: AllianceInput): number {
  const percent = offender.minorFouls * 5 + offender.majorFouls * 10;
  return ceilDiv(prePenaltyScore * percent, 100);
}

export function computeMatchScores(m: MatchInput): MatchScores {
  const coopertition = coopertitionBonus([...m.red.climbs, ...m.blue.climbs]);
  const redPre = alliancePreScore(m.red, m.extinguisher, coopertition);
  const bluePre = alliancePreScore(m.blue, m.extinguisher, coopertition);

  const red = redPre + foulPenalty(bluePre, m.blue);
  const blue = bluePre + foulPenalty(redPre, m.red);

  return {
    red, blue, redPre, bluePre, coopertition,
    redMultiplier: climbMultiplierHundredths(m.red.climbs) / 100,
    blueMultiplier: climbMultiplierHundredths(m.blue.climbs) / 100,
  };
}
