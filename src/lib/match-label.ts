/**
 * How a match is named everywhere the hall can see it — the projector, the
 * public board and the referee's match list all go through this, so they can
 * never announce the same match under two different names.
 *
 * Qualification keeps the short Q form the schedule is printed with. The
 * playoff is spelled out: "P1" is not something anyone announces at the event,
 * and the three playoff matches restart at 1, so a bare number would read as
 * the qualification match of the same number.
 */
export function matchLabel(phase: 'qualification' | 'playoff', number: number): string {
  return phase === 'playoff' ? `Match ${number}` : `Q${number}`;
}
