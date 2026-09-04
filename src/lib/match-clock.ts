/** A FIRST Global match runs 2:30. */
export const MATCH_DURATION_MS = 150_000;
/** The last 30 seconds are the endgame — announced to the hall. */
export const ENDGAME_MS = 30_000;
/** 3-2-1 between the referee pressing Start and the match actually running. */
export const COUNTDOWN_MS = 3_000;

export type ClockPeriod = 'pre' | 'countdown' | 'running' | 'endgame' | 'over';

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
 * Where the match on screen is, from the moment the referee started it.
 *
 * `startedAt` is when the match itself begins, and Start sets it a few seconds
 * ahead so the hall gets 3-2-1 first: until then this is 'countdown' and the
 * label is the bare number. A match only previewed on screen has no start at
 * all and sits at 2:30 — nothing here ever pretends a match is running.
 *
 * Both times are server-side milliseconds; the display page corrects the
 * projector laptop's clock against the server's before calling this. The
 * countdown is capped at COUNTDOWN_MS regardless, so a clock that is still
 * wildly ahead shows "3" and then runs, instead of freezing on a number that
 * counts down from minutes.
 */
export function matchClock(startedAt: number | null, now: number): MatchClock {
  if (startedAt === null) {
    return { remainingMs: MATCH_DURATION_MS, period: 'pre', label: label(MATCH_DURATION_MS) };
  }

  if (now < startedAt) {
    const untilStart = Math.min(startedAt - now, COUNTDOWN_MS);
    return {
      remainingMs: MATCH_DURATION_MS,
      period: 'countdown',
      label: String(Math.ceil(untilStart / 1000)),
    };
  }

  const elapsed = Math.min(now - startedAt, MATCH_DURATION_MS);
  const remainingMs = MATCH_DURATION_MS - elapsed;

  const period: ClockPeriod =
    remainingMs <= 0 ? 'over'
    : remainingMs <= ENDGAME_MS ? 'endgame'
    : 'running';

  return { remainingMs, period, label: label(remainingMs) };
}
