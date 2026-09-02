export interface ScheduledMatch {
  matchNumber: number;
  red: number[];
  blue: number[];
}

/** Детерминированный ГПСЧ — расписание воспроизводимо по seed. */
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
  if (teamIds.length < 6) throw new Error('Для расписания нужно минимум 6 команд');
  if (matchesPerTeam < 1) throw new Error('Матчей на команду должно быть не меньше одного');

  const rng = mulberry32(seed);
  const totalMatches = Math.floor((teamIds.length * matchesPerTeam) / 6);
  const appearances = new Map(teamIds.map((id) => [id, 0]));
  const lastPlayed = new Map(teamIds.map((id) => [id, -Infinity]));
  const schedule: ScheduledMatch[] = [];

  for (let i = 0; i < totalMatches; i++) {
    // Приоритет: кто меньше играл, затем кто дольше не выходил, затем случайно.
    const picked = [...teamIds]
      .map((id) => ({ id, r: rng() }))
      .sort((a, b) =>
        (appearances.get(a.id)! - appearances.get(b.id)!)
        || (lastPlayed.get(a.id)! - lastPlayed.get(b.id)!)
        || (a.r - b.r))
      .slice(0, 6)
      .map((x) => x.id);

    // Случайно тасуем шестёрку и делим пополам.
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
