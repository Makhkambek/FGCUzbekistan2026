import { ceilDiv, climbMultiplierHundredths } from '../scoring/match';
import type { CardType, ClimbPosition } from '../scoring/types';

/**
 * A ball thrown in by the human player is worth five, where a ball scored by
 * the robot is worth one. Everything else about a skills attempt is scored
 * exactly like an alliance in an ordinary match.
 */
export const HUMAN_BALL_POINTS = 5;

/** How many attempts each team gets, unless the operator changes it. */
export const DEFAULT_ATTEMPTS = 3;

export interface SkillsAttemptInput {
  /** Balls the robot scored — one point each. */
  suppression: number;
  /** Balls the human player threw in — five points each. */
  humanBalls: number;
  /** One team means one robot, so one climb. */
  climb: ClimbPosition;
  extinguisher: number;
  minorFouls: number;
  majorFouls: number;
  card: CardType;
}

/**
 * What one attempt is worth.
 *
 * The alliance formula, with a single robot: the ball total (robot balls plus
 * five per human-player ball) takes the climb multiplier, then the
 * extinguisher is added flat.
 *
 * Fouls are the one place where skills cannot copy a match. In a match a foul
 * hands its percentage to the opposing alliance; in skills there is no
 * opposing alliance, so the percentage comes off the offending team's own
 * score instead — the only place left for it to go. Percentages still add up
 * against one base and round once, as the manual requires, and the result
 * never goes below zero.
 *
 * A red card zeroes the attempt, matching what it does to an alliance in the
 * playoff.
 */
export function skillsAttemptScore(a: SkillsAttemptInput): number {
  if (a.card === 'red') return 0;

  const balls = a.suppression + HUMAN_BALL_POINTS * a.humanBalls;
  const preFoul = ceilDiv(balls * climbMultiplierHundredths([a.climb]), 100) + a.extinguisher;

  const percent = a.minorFouls * 5 + a.majorFouls * 10;
  return Math.max(0, preFoul - ceilDiv(preFoul * percent, 100));
}

export interface SkillsAttemptSlot {
  round: number;
  teamId: number;
}

/**
 * The running order: every team's first attempt, then every team's second, and
 * so on. Three attempts in a row for one team would leave them no time to fix
 * a robot between them, and would bore the hall.
 *
 * Team order is the operator's — the list arrives in the order they chose.
 */
export function skillsAttemptOrder(teamIds: number[], attemptsPerTeam: number): SkillsAttemptSlot[] {
  const slots: SkillsAttemptSlot[] = [];
  for (let round = 1; round <= attemptsPerTeam; round++) {
    for (const teamId of teamIds) slots.push({ round, teamId });
  }
  return slots;
}

export interface ScoredAttempt {
  teamId: number;
  round: number;
  score: number;
  played: boolean;
}

export interface SkillsStanding {
  teamId: number;
  total: number;
  best: number;
  attemptsPlayed: number;
}

/**
 * The skills table: every attempt a team has completed, added up.
 *
 * Nothing is dropped — unlike the qualification ranking, which averages and
 * throws away a team's worst match, skills is the sum of what they managed.
 * Ties break on the single best attempt, then on team id so the order never
 * depends on which row the database returned first.
 */
export function skillsStandings(teamIds: number[], attempts: ScoredAttempt[]): SkillsStanding[] {
  const standings = teamIds.map((teamId) => {
    const played = attempts.filter((a) => a.teamId === teamId && a.played);
    return {
      teamId,
      total: played.reduce((sum, a) => sum + a.score, 0),
      best: played.reduce((max, a) => Math.max(max, a.score), 0),
      attemptsPlayed: played.length,
    };
  });

  return standings.sort((a, b) =>
    (b.total - a.total) || (b.best - a.best) || (a.teamId - b.teamId));
}

export interface TeamAttempt {
  round: number;
  /** null until the attempt has actually been taken. */
  score: number | null;
  played: boolean;
}

/**
 * Every team's attempts, in running order, keyed by team.
 *
 * The board shows one team at a time — the hall wants to know how a team's
 * three tries went, not how the fourteenth attempt of the afternoon went — so
 * the rounds a team has not reached yet stay in the list with no score rather
 * than being left out and shortening it.
 */
export function skillsAttemptsByTeam(
  teamIds: number[], attempts: ScoredAttempt[],
): Record<number, TeamAttempt[]> {
  return Object.fromEntries(teamIds.map((teamId) => [
    teamId,
    attempts
      .filter((a) => a.teamId === teamId)
      .sort((a, b) => a.round - b.round)
      .map((a) => ({ round: a.round, score: a.played ? a.score : null, played: a.played })),
  ]));
}

/**
 * The teams in the running order, each named once, in the order the operator
 * built.
 *
 * The board lists a team from the moment it is picked, on nil points until it
 * takes its first attempt: the hall wants to know who is due to run, and a
 * table that fills up one team at a time hides the running order from
 * everyone standing in front of it.
 */
export function skillsTeamIds(attempts: ScoredAttempt[]): number[] {
  return [...new Set(attempts.map((a) => a.teamId))];
}
