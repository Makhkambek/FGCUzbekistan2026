import type { AllianceSlot } from './selection';

export interface PlayoffPairing {
  matchNumber: number;
  redSeed: number;
  blueSeed: number;
}

export interface AllianceScore {
  seed: number;
  total: number;
  matchesPlayed: number;
}

/** Round robin between the three alliances — Table 6-3 of the manual. */
export const PLAYOFF_PAIRINGS: PlayoffPairing[] = [
  { matchNumber: 1, redSeed: 1, blueSeed: 3 },
  { matchNumber: 2, redSeed: 3, blueSeed: 2 },
  { matchNumber: 3, redSeed: 2, blueSeed: 1 },
];

export function allianceTeams(slot: AllianceSlot): number[] {
  if (slot.picks.some((p) => p === null)) {
    throw new Error(`Alliance ${slot.seed} is not complete yet`);
  }
  return [slot.captain, ...(slot.picks as [number, number])];
}

/**
 * The score a TOURNAMENT ALLIANCE takes from one PLAYOFF match, given the
 * cards of its three teams in that match.
 *
 * A RED CARD in the playoff zeroes the WHOLE alliance for that match, not
 * just the carded team — that is the one place where the playoff differs from
 * the qualification, where only the team itself is zeroed (see
 * `teamResultsFromRows` in src/lib/standings.ts). Manual, RED CARD: "In
 * PLAYOFF and FINAL MATCHES, when a team is issued a RED CARD, the full
 * TOURNAMENT ALLIANCE receives 0 points for that specific MATCH."
 *
 * Only the red card does this. The manual states the WHITE CARD consequence
 * for RANKING MATCHES only and says nothing about the playoff, so it is read
 * literally here and leaves the alliance score alone.
 */
export function allianceMatchScore(score: number, cards: string[]): number {
  return cards.some((c) => c === 'red') ? 0 : score;
}

export function computeAllianceStandings(
  scoresBySeed: { seed: number; score: number }[],
): AllianceScore[] {
  const totals = new Map<number, AllianceScore>(
    [1, 2, 3].map((seed) => [seed, { seed, total: 0, matchesPlayed: 0 }]),
  );
  for (const { seed, score } of scoresBySeed) {
    const cur = totals.get(seed);
    if (!cur) continue;
    cur.total += score;
    cur.matchesPlayed += 1;
  }
  return [...totals.values()].sort((a, b) => b.total - a.total || a.seed - b.seed);
}

/**
 * Whether the playoff is finished — the bracket exists and every match in it
 * has been played.
 *
 * The skills award is the last thing the event does, and its table must not
 * appear on the public board before the finals are decided: a second table of
 * numbers beside the bracket splits the hall's attention at the one moment
 * the tournament has been building towards.
 *
 * A bracket that does not exist yet is not a finished one, and qualification
 * matches have no say here — one left unscored by mistake cannot hold the
 * award back once the finals themselves are done.
 */
export function finalsAreOver(matches: { phase: string; played: boolean }[]): boolean {
  const playoff = matches.filter((m) => m.phase === 'playoff');
  return playoff.length > 0 && playoff.every((m) => m.played);
}
