import { computeMatchScores } from './scoring/match';
import { matchRowToInput } from './standings';
import type { MatchRow } from './db/matches';

export type DisplayPhase = 'standings' | 'live' | 'result';

export interface DisplayState {
  phase: DisplayPhase;
  matchId: number | null;
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
}

export interface DisplayResult {
  phase: 'result';
  matchNumber: number;
  matchPhase: 'qualification' | 'playoff';
  red: AllianceLineup & { score: number };
  blue: AllianceLineup & { score: number };
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
    };
  }

  const scores = computeMatchScores(matchRowToInput(match));
  const winner = scores.red > scores.blue ? 'red' : scores.blue > scores.red ? 'blue' : 'tie';

  return {
    phase: 'result',
    matchNumber: match.match_number,
    matchPhase: match.phase,
    red: { teams: red, score: scores.red },
    blue: { teams: blue, score: scores.blue },
    winner,
  };
}
