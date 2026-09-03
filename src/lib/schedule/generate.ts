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

/**
 * What the operator actually gets for a team count and a matches-per-team.
 *
 * Six teams play each match, so unless `teams × matchesPerTeam` divides by 6
 * the schedule cannot give everyone the same number of matches: `withExtra`
 * teams play one more than the rest. The ranking averages and drops each
 * team's worst match, so an extra match does not inflate the ranking score
 * itself — but it is one more chance at the best-single-match tiebreaker and
 * one more match in the suppression total, so the operator should know.
 */
export function scheduleShape(teams: number, matchesPerTeam: number) {
  const totalMatches = Math.ceil((teams * matchesPerTeam) / 6);
  const slots = totalMatches * 6;
  return {
    totalMatches,
    base: Math.floor(slots / teams),
    withExtra: slots % teams,
  };
}

/**
 * The nearest matches-per-team that comes out even for this team count, or
 * null when the requested number already does.
 */
export function evenMatchesPerTeam(teams: number, matchesPerTeam: number): number | null {
  if ((teams * matchesPerTeam) % 6 === 0) return null;
  for (let delta = 1; delta <= 20; delta++) {
    if (matchesPerTeam - delta >= 1 && (teams * (matchesPerTeam - delta)) % 6 === 0) {
      return matchesPerTeam - delta;
    }
    if (matchesPerTeam + delta <= 20 && (teams * (matchesPerTeam + delta)) % 6 === 0) {
      return matchesPerTeam + delta;
    }
  }
  return null;
}

export function generateSchedule(
  teamIds: number[], matchesPerTeam: number, seed: number,
): ScheduledMatch[] {
  if (teamIds.length < 6) throw new Error('A schedule needs at least 6 teams');
  if (matchesPerTeam < 1) throw new Error('Matches per team must be at least one');

  const rng = mulberry32(seed);
  // Rounding up, not down: with floor, any team count whose product with
  // matchesPerTeam is not divisible by 6 left teams short of the number of
  // matches the operator asked for — at 9 teams and 1 match each, three teams
  // played nothing at all and silently ranked last. Erring upwards gives some
  // teams one extra match instead, which the ranking already handles (it
  // averages and drops the lowest).
  const totalMatches = Math.ceil((teamIds.length * matchesPerTeam) / 6);
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
