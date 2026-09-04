import { matchScoresForDisplay } from './standings';
import type { MatchRow } from './db/matches';

export type DisplayPhase = 'standings' | 'live' | 'result';

export interface DisplayState {
  phase: DisplayPhase;
  matchId: number | null;
  /** The projector points at a match or a skills attempt, never both. */
  skillsAttemptId: number | null;
  /** Server time the referee started the match, or null when nothing is live. */
  startedAt: number | null;
  /** Server time this state was read, so a client can correct its own clock. */
  serverNow: number;
}

export interface AllianceLineup {
  teams: string[];
  /**
   * Where each of those teams stands, in the same order as `teams`: their
   * qualification ranking during quals, their alliance's seed during the
   * playoff. null for a team with no standing yet — the screen shows nothing
   * rather than a misleading zero.
   */
  ranks: (number | null)[];
}

export interface DisplayStandings {
  phase: 'standings';
}

export interface DisplayLive {
  phase: 'live';
  matchNumber: number;
  matchPhase: 'qualification' | 'playoff';
  /** What the numbers beside the team names mean on this screen. */
  rankKind: RankKind;
  red: AllianceLineup;
  blue: AllianceLineup;
  /** Both in server time — the projector counts 2:30 down from the difference. */
  startedAt: number | null;
  serverNow: number;
}

export interface AllianceBreakdown {
  suppression: number;
  multiplier: number;
  partnerClimbPoints: number;
  penalty: number;
}

export interface DisplayResult {
  phase: 'result';
  matchNumber: number;
  matchPhase: 'qualification' | 'playoff';
  rankKind: RankKind;
  red: AllianceLineup & { score: number } & AllianceBreakdown;
  blue: AllianceLineup & { score: number } & AllianceBreakdown;
  extinguisher: number;
  coopertition: number;
  winner: 'red' | 'blue' | 'tie';
}

/** A number beside a team name is either its own rank or its alliance's seed. */
export type RankKind = 'team' | 'alliance';

/** teamId -> qualification ranking, or -> alliance seed during the playoff. */
export type RankMap = Record<number, number | undefined>;

export type DisplayPayload =
  | DisplayStandings | DisplayLive | DisplayResult | DisplaySkills;

const STANDINGS: DisplayStandings = { phase: 'standings' };

function lineup(ids: number[], teamNames: Record<number, string>, ranks: RankMap): AllianceLineup {
  return {
    teams: ids.map((id) => teamNames[id] ?? '—'),
    ranks: ids.map((id) => ranks[id] ?? null),
  };
}

export function buildDisplayPayload(
  state: DisplayState,
  match: MatchRow | null,
  teamNames: Record<number, string>,
  ranks: RankMap = {},
): DisplayPayload {
  if (state.phase === 'standings' || match === null) return STANDINGS;

  const red = lineup([match.red1_id, match.red2_id, match.red3_id], teamNames, ranks);
  const blue = lineup([match.blue1_id, match.blue2_id, match.blue3_id], teamNames, ranks);
  // During the playoff a team's own qualification ranking is history; what
  // the hall needs beside the name is which alliance it is playing for.
  const rankKind: RankKind = match.phase === 'playoff' ? 'alliance' : 'team';

  if (state.phase === 'live') {
    return {
      phase: 'live',
      matchNumber: match.match_number,
      matchPhase: match.phase,
      rankKind,
      red,
      blue,
      startedAt: state.startedAt,
      serverNow: state.serverNow,
    };
  }

  const scores = matchScoresForDisplay(match);
  const winner = scores.red > scores.blue ? 'red' : scores.blue > scores.red ? 'blue' : 'tie';

  return {
    phase: 'result',
    matchNumber: match.match_number,
    matchPhase: match.phase,
    rankKind,
    red: {
      ...red, score: scores.red,
      suppression: match.suppression_red,
      multiplier: scores.redMultiplier,
      partnerClimbPoints: 25 * match.partner_climb_red,
      penalty: scores.red - scores.redPre,
    },
    blue: {
      ...blue, score: scores.blue,
      suppression: match.suppression_blue,
      multiplier: scores.blueMultiplier,
      partnerClimbPoints: 25 * match.partner_climb_blue,
      penalty: scores.blue - scores.bluePre,
    },
    extinguisher: match.extinguisher,
    coopertition: scores.coopertition,
    winner,
  };
}

/**
 * One team on the field, in the skills phase.
 *
 * The hall reads the same screen it has read all day: two alliances, three
 * slots each. The team stands in the first slot of the side it plays from and
 * every other slot is a dash — an empty field is the truth here, and inventing
 * a different layout for the last hour of the event would make the audience
 * relearn where to look.
 */
export interface DisplaySkills {
  phase: 'skills-live' | 'skills-result';
  round: number;
  teamName: string;
  /** The side the team plays from; the other alliance is all dashes. */
  alliance: 'red' | 'blue';
  red: AllianceLineup;
  blue: AllianceLineup;
  /** Present on the result screen only. */
  score: number | null;
  suppression: number;
  humanBalls: number;
  humanPoints: number;
  climbMultiplier: number;
  extinguisher: number;
  /** What the fouls took off, as a negative — 0 when there were none. */
  penalty: number;
  startedAt: number | null;
  serverNow: number;
}
