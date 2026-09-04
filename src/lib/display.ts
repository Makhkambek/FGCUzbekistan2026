import { matchScoresForDisplay } from './standings';
import type { MatchRow } from './db/matches';

export type DisplayPhase = 'standings' | 'live' | 'result';

export interface DisplayState {
  phase: DisplayPhase;
  matchId: number | null;
  /** Server time the referee started the match, or null when nothing is live. */
  startedAt: number | null;
  /** Server time this state was read, so a client can correct its own clock. */
  serverNow: number;
}

export interface AllianceLineup {
  teams: string[];
}

export interface DisplayStandings {
  phase: 'standings';
}

export interface DisplayLive {
  phase: 'live';
  matchNumber: number;
  matchPhase: 'qualification' | 'playoff';
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
  red: AllianceLineup & { score: number } & AllianceBreakdown;
  blue: AllianceLineup & { score: number } & AllianceBreakdown;
  extinguisher: number;
  coopertition: number;
  winner: 'red' | 'blue' | 'tie';
}

export type DisplayPayload = DisplayStandings | DisplayLive | DisplayResult;

const STANDINGS: DisplayStandings = { phase: 'standings' };

function lineup(ids: number[], teamNames: Record<number, string>): string[] {
  return ids.map((id) => teamNames[id] ?? '—');
}

export function buildDisplayPayload(
  state: DisplayState,
  match: MatchRow | null,
  teamNames: Record<number, string>,
): DisplayPayload {
  if (state.phase === 'standings' || match === null) return STANDINGS;

  const red = lineup([match.red1_id, match.red2_id, match.red3_id], teamNames);
  const blue = lineup([match.blue1_id, match.blue2_id, match.blue3_id], teamNames);

  if (state.phase === 'live') {
    return {
      phase: 'live',
      matchNumber: match.match_number,
      matchPhase: match.phase,
      red: { teams: red },
      blue: { teams: blue },
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
    red: {
      teams: red, score: scores.red,
      suppression: match.suppression_red,
      multiplier: scores.redMultiplier,
      partnerClimbPoints: 25 * match.partner_climb_red,
      penalty: scores.red - scores.redPre,
    },
    blue: {
      teams: blue, score: scores.blue,
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
