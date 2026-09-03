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
  return [slot.captain, ...slot.picks];
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
