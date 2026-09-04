export interface NextMatchCandidate {
  id: number;
  number: number;
  phase: 'qualification' | 'playoff';
  played: boolean;
}

export interface OnScreenMatch {
  phase: 'qualification' | 'playoff';
  number: number;
}

/**
 * What the projector announces as coming up next.
 *
 * Two rules the hall depends on:
 *
 * 1. The match currently on screen is never also "next" — when the live match
 *    is the last unplayed one of its phase, the fallback used to hand back
 *    that same match.
 * 2. Once the playoff bracket exists the event has moved on, so a
 *    qualification match left unplayed must never be announced. The earlier
 *    version only enforced this while unplayed playoff matches remained: with
 *    the bracket finished and a qualification result reset for a late
 *    correction, the closing ceremony would see "next: Q7".
 */
export function pickNextMatch<T extends NextMatchCandidate>(
  matches: T[],
  onScreen: OnScreenMatch | null,
  playoffBracketExists: boolean,
): T | null {
  if (onScreen) {
    const upcoming = matches
      .filter((m) => m.phase === onScreen.phase && m.number > onScreen.number && !m.played)
      .sort((a, b) => a.number - b.number);
    if (upcoming.length) return upcoming[0];
  }

  const remaining = matches
    .filter((m) => !m.played
      && !(onScreen && m.phase === onScreen.phase && m.number === onScreen.number))
    .sort((a, b) => (a.phase === b.phase ? a.number - b.number : a.phase === 'qualification' ? -1 : 1));

  if (playoffBracketExists) {
    return remaining.find((m) => m.phase === 'playoff') ?? null;
  }
  return remaining[0] ?? null;
}
