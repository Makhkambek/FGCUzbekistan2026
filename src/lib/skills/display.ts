import { HUMAN_BALL_POINTS, skillsAttemptScore } from './scoring';
import { climbMultiplierHundredths } from '../scoring/match';
import type { DisplaySkills, DisplayState } from '../display';
import type { SkillsAttemptRow } from '../db/skills';

/**
 * The projector's skills screen: the same shape as a match screen, with one
 * team instead of six.
 *
 * The human player's contribution is reported separately from the robot's
 * balls — on a match screen the hall reads one suppression number, and here
 * five points for one ball needs saying out loud rather than being buried in a
 * total nobody can reconstruct.
 */
export function buildSkillsPayload(
  state: DisplayState, attempt: SkillsAttemptRow, teamName: string,
): DisplaySkills {
  const live = state.phase === 'live';
  return {
    phase: live ? 'skills-live' : 'skills-result',
    round: attempt.round,
    teamName,
    alliance: attempt.alliance,
    score: live ? null : skillsAttemptScore({
      suppression: attempt.suppression,
      humanBalls: attempt.human_balls,
      climb: attempt.climb,
      extinguisher: attempt.extinguisher,
      minorFouls: attempt.minor_fouls,
      majorFouls: attempt.major_fouls,
      card: attempt.card,
    }),
    suppression: attempt.suppression,
    humanBalls: attempt.human_balls,
    humanPoints: attempt.human_balls * HUMAN_BALL_POINTS,
    climbMultiplier: climbMultiplierHundredths([attempt.climb]) / 100,
    extinguisher: attempt.extinguisher,
    startedAt: state.startedAt,
    serverNow: state.serverNow,
  };
}
