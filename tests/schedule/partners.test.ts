import { describe, it, expect } from 'vitest';
import { generateSchedule, type ScheduledMatch } from '@/lib/schedule/generate';

/**
 * FGC Uzbekistan, 8 команд: организатор просит, чтобы команда не попадала
 * в альянс с одной и той же командой дважды.
 *
 * Математика: у команды 7 возможных напарников, в матче напарник ровно один.
 * До 7 матчей на команду повторов можно избежать полностью. На 8 матчах
 * повтор неизбежен — 8 × 8 / 4 = 16 матчей, это 32 пары-слота на 28
 * возможных пар, то есть минимум 4 повторные пары. Расписание обязано
 * попадать в этот минимум, а не повторять пары как попало.
 */
const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

function partnerCounts(schedule: ScheduledMatch[]) {
  const counts = new Map<string, number>();
  for (const m of schedule) {
    for (const alliance of [m.red, m.blue]) {
      const key = pairKey(alliance[0], alliance[1]);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

/** Сколько раз альянс собрался повторно (сумма превышений над одним разом). */
const repeats = (schedule: ScheduledMatch[]) =>
  [...partnerCounts(schedule).values()].reduce((sum, n) => sum + Math.max(0, n - 1), 0);

const ids = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe('напарники в альянсе не повторяются, пока хватает пар', () => {
  it('8 команд × 7 матчей — ни одна пара не собирается дважды', () => {
    expect(repeats(generateSchedule(ids(8), 7, 42))).toBe(0);
  });

  it('12 команд × 5 матчей — тоже без повторов', () => {
    expect(repeats(generateSchedule(ids(12), 5, 42))).toBe(0);
  });

  it('не зависит от seed', () => {
    for (const seed of [1, 7, 42, 2026, 31337]) {
      expect(repeats(generateSchedule(ids(8), 7, seed)), `seed ${seed}`).toBe(0);
    }
  });
});

describe('8 команд × 8 матчей — повторов ровно столько, сколько неизбежно', () => {
  const schedule = generateSchedule(ids(8), 8, 42);

  it('каждая команда играет ровно 8 матчей', () => {
    const counts = new Map(ids(8).map((id) => [id, 0]));
    for (const m of schedule) {
      for (const id of [...m.red, ...m.blue]) counts.set(id, counts.get(id)! + 1);
    }
    expect([...counts.values()]).toEqual(Array(8).fill(8));
  });

  it('повторных альянсов ровно 4 — теоретический минимум', () => {
    expect(repeats(schedule)).toBe(4);
  });

  it('ни одна пара не собирается больше двух раз', () => {
    expect(Math.max(...partnerCounts(schedule).values())).toBeLessThanOrEqual(2);
  });

  it('у каждой команды ровно один повторный напарник, остальные шесть — разные', () => {
    for (const id of ids(8)) {
      const partners: number[] = [];
      for (const m of schedule) {
        for (const alliance of [m.red, m.blue]) {
          if (alliance.includes(id)) partners.push(alliance.find((x) => x !== id)!);
        }
      }
      expect(partners, `команда ${id}`).toHaveLength(8);
      expect(new Set(partners).size, `команда ${id}`).toBe(7);
    }
  });

  it('минимум держится на любом seed', () => {
    for (const seed of [1, 7, 2026, 31337]) {
      expect(repeats(generateSchedule(ids(8), 8, seed)), `seed ${seed}`).toBe(4);
    }
  });
});
