/** A FIRST Global match runs 2:30. */
export const MATCH_DURATION_MS = 150_000;
/** The last 30 seconds are the endgame — announced to the hall. */
export const ENDGAME_MS = 30_000;

export type ClockPeriod = 'pre' | 'running' | 'endgame' | 'over';

export interface MatchClock {
  remainingMs: number;
  period: ClockPeriod;
  /** M:SS, ready to print at projector size. */
  label: string;
}

function label(remainingMs: number): string {
  const total = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Where the match on screen is in its 2:30, from the moment the referee
 * started it.
 *
 * `startedAt` and `now` are both server-side milliseconds — the display page
 * corrects the projector laptop's clock against the server's before calling
 * this. A clock still running ahead would otherwise produce a negative
 * elapsed time and a countdown starting above 2:30, so elapsed is clamped
 * into the match at both ends.
 */
export function matchClock(startedAt: number | null, now: number): MatchClock {
  if (startedAt === null) {
    return { remainingMs: MATCH_DURATION_MS, period: 'pre', label: label(MATCH_DURATION_MS) };
  }

  const elapsed = Math.min(Math.max(now - startedAt, 0), MATCH_DURATION_MS);
  const remainingMs = MATCH_DURATION_MS - elapsed;

  const period: ClockPeriod =
    remainingMs <= 0 ? 'over'
    : remainingMs <= ENDGAME_MS ? 'endgame'
    : 'running';

  return { remainingMs, period, label: label(remainingMs) };
}
