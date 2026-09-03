export interface ScheduledMatch {
  matchNumber: number;
  red: number[];
  blue: number[];
}

/** Deterministic PRNG — the schedule is reproducible from the seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSchedule(
  teamIds: number[], matchesPerTeam: number, seed: number,
): ScheduledMatch[] {
  if (teamIds.length < 6) throw new Error('A schedule needs at least 6 teams');
  if (matchesPerTeam < 1) throw new Error('Matches per team must be at least one');

  const rng = mulberry32(seed);
  const totalMatches = Math.floor((teamIds.length * matchesPerTeam) / 6);
  const appearances = new Map(teamIds.map((id) => [id, 0]));
  const lastPlayed = new Map(teamIds.map((id) => [id, -Infinity]));
  const schedule: ScheduledMatch[] = [];

  for (let i = 0; i < totalMatches; i++) {
    // Priority: fewest matches played, then longest time off the field, then random.
    const picked = [...teamIds]
      .map((id) => ({ id, r: rng() }))
      .sort((a, b) =>
        (appearances.get(a.id)! - appearances.get(b.id)!)
        || (lastPlayed.get(a.id)! - lastPlayed.get(b.id)!)
        || (a.r - b.r))
      .slice(0, 6)
      .map((x) => x.id);

    // Shuffle the six at random and split them in half.
    for (let j = picked.length - 1; j > 0; j--) {
      const k = Math.floor(rng() * (j + 1));
      [picked[j], picked[k]] = [picked[k], picked[j]];
    }

    for (const id of picked) {
      appearances.set(id, appearances.get(id)! + 1);
      lastPlayed.set(id, i);
    }

    schedule.push({ matchNumber: i + 1, red: picked.slice(0, 3), blue: picked.slice(3, 6) });
  }

  return schedule;
}
