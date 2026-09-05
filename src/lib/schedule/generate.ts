/**
 * From 5 September 2026 an alliance is two robots in qualification as well as
 * in the finals, so four teams take the field per match rather than six.
 */
export const TEAMS_PER_ALLIANCE = 2;
export const TEAMS_PER_MATCH = TEAMS_PER_ALLIANCE * 2;

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
 * Four teams play each match, so unless `teams × matchesPerTeam` divides by 4
 * the schedule cannot give everyone the same number of matches: `withExtra`
 * teams play one more than the rest. The ranking averages and drops each
 * team's worst match, so an extra match does not inflate the ranking score
 * itself — but it is one more chance at the best-single-match tiebreaker and
 * one more match in the suppression total, so the operator should know.
 */
export function scheduleShape(teams: number, matchesPerTeam: number) {
  const totalMatches = Math.ceil((teams * matchesPerTeam) / TEAMS_PER_MATCH);
  const slots = totalMatches * TEAMS_PER_MATCH;
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
  if ((teams * matchesPerTeam) % TEAMS_PER_MATCH === 0) return null;
  for (let delta = 1; delta <= 20; delta++) {
    if (matchesPerTeam - delta >= 1 && (teams * (matchesPerTeam - delta)) % TEAMS_PER_MATCH === 0) {
      return matchesPerTeam - delta;
    }
    if (matchesPerTeam + delta <= 20 && (teams * (matchesPerTeam + delta)) % TEAMS_PER_MATCH === 0) {
      return matchesPerTeam + delta;
    }
  }
  return null;
}

const pairKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

/** Все три способа разбить четвёрку на два альянса. */
const SPLITS: ReadonlyArray<readonly number[]> = [[0, 1, 2, 3], [0, 2, 1, 3], [0, 3, 1, 2]];

/**
 * Во что обходится расписание: сначала повторные альянсы, потом повторные
 * встречи соперников. Организатор FGC Uzbekistan просит, чтобы команда не
 * попадала в альянс с одной и той же дважды — при восьми командах и восьми
 * матчах полностью избежать этого нельзя (32 пары-слота на 28 возможных пар),
 * поэтому цель — попасть в математический минимум, а не в «как повезёт».
 */
function scheduleCost(
  partners: Map<string, number>, opponents: Map<string, number>, restCost: number,
) {
  let partnerRepeats = 0;
  for (const n of partners.values()) partnerRepeats += Math.max(0, n - 1);
  let opponentSpread = 0;
  for (const n of opponents.values()) opponentSpread += n * n;
  return partnerRepeats * 100000 + restCost * 20 + opponentSpread;
}

function buildAttempt(
  teamIds: number[], totalMatches: number, rng: () => number,
): { schedule: ScheduledMatch[]; cost: number } {
  const appearances = new Map(teamIds.map((id) => [id, 0]));
  const lastPlayed = new Map(teamIds.map((id) => [id, -Infinity]));
  const partners = new Map<string, number>();
  const opponents = new Map<string, number>();
  const schedule: ScheduledMatch[] = [];
  let restCost = 0;

  for (let i = 0; i < totalMatches; i++) {
    // Число сыгранных матчей решает — это оно держит разброс в один матч.
    // Отдых сюда больше не входит: при восьми командах сортировка «кто дольше
    // не играл» намертво возвращала на поле ту же четвёрку, и напарники
    // повторялись по кругу. Теперь отдых — цена всего расписания (restCost),
    // а не жёсткое правило одного матча.
    const picked = [...teamIds]
      .map((id) => ({ id, r: rng() }))
      .sort((a, b) =>
        (appearances.get(a.id)! - appearances.get(b.id)!)
        || (a.r - b.r))
      .slice(0, TEAMS_PER_MATCH)
      .map((x) => x.id);

    // Из трёх разбиений четвёрки берём то, где альянсы повторяются меньше
    // всего, а при равенстве — где команды реже уже встречались соперниками.
    let best = SPLITS[0];
    let bestCost = Infinity;
    for (const split of SPLITS) {
      const [r0, r1, b0, b1] = split.map((k) => picked[k]);
      const repeatCost = (partners.get(pairKey(r0, r1)) ?? 0) + (partners.get(pairKey(b0, b1)) ?? 0);
      const facedCost = [[r0, b0], [r0, b1], [r1, b0], [r1, b1]]
        .reduce((sum, [x, y]) => sum + (opponents.get(pairKey(x, y)) ?? 0), 0);
      const cost = repeatCost * 100 + facedCost + rng() * 0.5;
      if (cost < bestCost) {
        bestCost = cost;
        best = split;
      }
    }

    const [r0, r1, b0, b1] = best.map((k) => picked[k]);
    for (const id of picked) {
      // Подряд идущие матчи для одной команды дороже, чем матч через один.
      const gap = i - lastPlayed.get(id)!;
      if (Number.isFinite(gap)) restCost += Math.max(0, 3 - gap) ** 2;
      appearances.set(id, appearances.get(id)! + 1);
      lastPlayed.set(id, i);
    }
    for (const key of [pairKey(r0, r1), pairKey(b0, b1)]) {
      partners.set(key, (partners.get(key) ?? 0) + 1);
    }
    for (const [x, y] of [[r0, b0], [r0, b1], [r1, b0], [r1, b1]]) {
      const key = pairKey(x, y);
      opponents.set(key, (opponents.get(key) ?? 0) + 1);
    }

    schedule.push({ matchNumber: i + 1, red: [r0, r1], blue: [b0, b1] });
  }

  return { schedule, cost: scheduleCost(partners, opponents, restCost) };
}

/** Сколько расписаний перебрать, прежде чем взять лучшее. */
const ATTEMPTS = 400;

export function generateSchedule(
  teamIds: number[], matchesPerTeam: number, seed: number,
): ScheduledMatch[] {
  if (teamIds.length < TEAMS_PER_MATCH) {
    throw new Error(`A schedule needs at least ${TEAMS_PER_MATCH} teams`);
  }
  if (matchesPerTeam < 1) throw new Error('Matches per team must be at least one');

  const rng = mulberry32(seed);
  // Rounding up, not down: with floor, any team count whose product with
  // matchesPerTeam is not divisible by 4 left teams short of the number of
  // matches the operator asked for — at 9 teams and 1 match each, five teams
  // played nothing at all and silently ranked last. Erring upwards gives some
  // teams one extra match instead, which the ranking already handles (it
  // averages and drops the lowest).
  const totalMatches = Math.ceil((teamIds.length * matchesPerTeam) / TEAMS_PER_MATCH);

  // Одного жадного прохода мало: он видит только текущий матч и к концу
  // расписания упирается в уже занятые пары. Перебираем сотни проходов от
  // одного и того же seed (расписание остаётся воспроизводимым) и берём то,
  // где повторных альянсов меньше всего.
  let best = buildAttempt(teamIds, totalMatches, rng);
  for (let i = 1; i < ATTEMPTS; i++) {
    const attempt = buildAttempt(teamIds, totalMatches, rng);
    if (attempt.cost < best.cost) best = attempt;
  }

  return best.schedule;
}

/**
 * What the operator typed into "matches per team", or null while the field is
 * empty or not yet a number.
 *
 * Null matters: the field used to substitute 1 for an empty value, so the box
 * could never be cleared — deleting the 1 put it straight back and the next
 * digit typed landed beside it. Asking for 9 gave 19.
 */
export function parseMatchesPerTeam(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n)) return null;
  return Math.min(20, Math.max(1, n));
}
