import { HUMAN_BALL_POINTS, skillsAttemptScore } from './scoring';
import { ceilDiv, climbMultiplierHundredths } from '../scoring/match';
import type { AllianceLineup, DisplaySkills, DisplayState } from '../display';
import type { SkillsAttemptRow } from '../db/skills';

/** An empty slot on the field. There is no team there to name. */
const EMPTY = '—';

function soloLineup(teamName: string | null): AllianceLineup {
  return {
    teams: [teamName ?? EMPTY, EMPTY, EMPTY],
    ranks: [null, null, null],
  };
}

/**
 * The projector's skills screen: the match screen, with one team instead of
 * six. The team stands in the first slot of the side it plays from; the other
 * two slots and the whole opposing alliance are dashes.
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
  const score = skillsAttemptScore({
    suppression: attempt.suppression,
    humanBalls: attempt.human_balls,
    climb: attempt.climb,
    extinguisher: attempt.extinguisher,
    minorFouls: attempt.minor_fouls,
    majorFouls: attempt.major_fouls,
    card: attempt.card,
  });

  // What the attempt was worth before the fouls came off it, so the screen can
  // show the deduction on its own line the way a match screen does.
  const balls = attempt.suppression + HUMAN_BALL_POINTS * attempt.human_balls;
  const preFoul = ceilDiv(balls * climbMultiplierHundredths([attempt.climb]), 100)
    + attempt.extinguisher;

  return {
    phase: live ? 'skills-live' : 'skills-result',
    round: attempt.round,
    teamName,
    alliance: attempt.alliance,
    red: soloLineup(attempt.alliance === 'red' ? teamName : null),
    blue: soloLineup(attempt.alliance === 'blue' ? teamName : null),
    score: live ? null : score,
    penalty: score - preFoul,
    suppression: attempt.suppression,
    humanBalls: attempt.human_balls,
    humanPoints: attempt.human_balls * HUMAN_BALL_POINTS,
    climbMultiplier: climbMultiplierHundredths([attempt.climb]) / 100,
    extinguisher: attempt.extinguisher,
    startedAt: state.startedAt,
    serverNow: state.serverNow,
  };
}
