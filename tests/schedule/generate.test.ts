import { describe, it, expect } from 'vitest';
import {
  generateSchedule, scheduleShape, evenMatchesPerTeam, parseMatchesPerTeam,
  TEAMS_PER_ALLIANCE, TEAMS_PER_MATCH,
} from '@/lib/schedule/generate';

const teams = Array.from({ length: 12 }, (_, i) => i + 1);

describe('квалификация — два робота в альянсе', () => {
  it('в матче четыре команды, по две на альянс', () => {
    expect(TEAMS_PER_ALLIANCE).toBe(2);
    expect(TEAMS_PER_MATCH).toBe(4);
  });

  it('требует минимум четыре команды', () => {
    expect(() => generateSchedule([1, 2, 3], 3, 42)).toThrow(/at least 4 teams/i);
  });

  it('четырёх команд уже хватает', () => {
    expect(() => generateSchedule([1, 2, 3, 4], 1, 42)).not.toThrow();
  });

  it('в каждом альянсе ровно две команды', () => {
    for (const m of generateSchedule(teams, 5, 42)) {
      expect(m.red).toHaveLength(2);
      expect(m.blue).toHaveLength(2);
    }
  });

  it('команда не встречается дважды в одном матче', () => {
    for (const m of generateSchedule(teams, 5, 42)) {
      expect(new Set([...m.red, ...m.blue]).size).toBe(4);
    }
  });
});

describe('generateSchedule', () => {
  it('каждая команда играет заданное число матчей (допуск ±1)', () => {
    const schedule = generateSchedule(teams, 5, 42);
    const counts = new Map<number, number>();
    for (const m of schedule) {
      for (const t of [...m.red, ...m.blue]) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    for (const t of teams) {
      expect(Math.abs((counts.get(t) ?? 0) - 5)).toBeLessThanOrEqual(1);
    }
  });

  it('номера матчей идут подряд с единицы', () => {
    const schedule = generateSchedule(teams, 5, 42);
    expect(schedule.map((m) => m.matchNumber)).toEqual(schedule.map((_, i) => i + 1));
  });

  it('один и тот же seed даёт один и тот же результат', () => {
    expect(generateSchedule(teams, 5, 42)).toEqual(generateSchedule(teams, 5, 42));
  });

  it('разные seed дают разные расписания', () => {
    expect(generateSchedule(teams, 5, 42)).not.toEqual(generateSchedule(teams, 5, 7));
  });

  it('неравномерный расход (13 команд) использует допуск ±1', () => {
    // 13 команд × 5 матчей / 4 команды в матче = 16.25 → 17 матчей,
    // 68 появлений на 13 команд — у кого-то 5, у кого-то 6.
    const teams13 = Array.from({ length: 13 }, (_, i) => i + 1);
    const schedule = generateSchedule(teams13, 5, 42);
    const counts = new Map<number, number>();
    for (const m of schedule) {
      for (const t of [...m.red, ...m.blue]) counts.set(t, (counts.get(t) ?? 0) + 1);
      expect(new Set([...m.red, ...m.blue]).size).toBe(4);
    }
    for (const t of teams13) {
      expect(Math.abs((counts.get(t) ?? 0) - 5)).toBeLessThanOrEqual(1);
    }
  });
});

describe('generateSchedule — недобор матчей', () => {
  // Мануал §6.3: «Each team will play a set number of RANKING MATCHES».
  // Округление вниз давало командам МЕНЬШЕ матчей, чем запросил оператор.
  const countPerTeam = (teamIds: number[], perTeam: number, seed: number) => {
    const schedule = generateSchedule(teamIds, perTeam, seed);
    const counts = new Map(teamIds.map((id) => [id, 0]));
    for (const m of schedule) {
      for (const id of [...m.red, ...m.blue]) counts.set(id, counts.get(id)! + 1);
    }
    return [...counts.values()];
  };

  it('никто не играет меньше запрошенного, когда произведение не делится на 4', () => {
    for (const [teams, perTeam] of [[7, 9], [7, 1], [9, 1], [9, 5], [13, 5], [6, 5], [11, 3]] as const) {
      const ids = Array.from({ length: teams }, (_, i) => i + 1);
      const counts = countPerTeam(ids, perTeam, 42);
      expect(Math.min(...counts), `${teams} команд × ${perTeam}`).toBeGreaterThanOrEqual(perTeam);
    }
  });

  it('разброс между командами не больше одного матча', () => {
    const ids = Array.from({ length: 7 }, (_, i) => i + 1);
    const counts = countPerTeam(ids, 9, 7);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });
});

describe('scheduleShape — что реально получит оператор', () => {
  it('считает, сколько команд сыграет на матч больше', () => {
    // 7 команд по 9 матчей = 63 места, это 16 матчей (64 места):
    // одной команде достаётся десятая игра.
    expect(scheduleShape(7, 9)).toEqual({ totalMatches: 16, base: 9, withExtra: 1 });
    // 12 × 8 = 96 = ровно 24 матча, всем поровну.
    expect(scheduleShape(12, 8)).toEqual({ totalMatches: 24, base: 8, withExtra: 0 });
  });

  it('подсказывает ближайшее число матчей, которое делится ровно', () => {
    expect(evenMatchesPerTeam(7, 9)).toBe(8);   // 7 × 8 = 56 = 14 матчей ровно
    expect(evenMatchesPerTeam(6, 5)).toBe(4);   // 6 × 4 = 24 = 6 матчей ровно
    expect(evenMatchesPerTeam(12, 8)).toBeNull(); // уже ровно
  });
});

describe('parseMatchesPerTeam — поле «matches per team»', () => {
  // Поле нельзя было очистить: пустое значение подставляло 1, и следующая
  // набранная цифра дописывалась к ней — вместо 9 получалось 19.
  it('пустое поле — это ещё не число, а не единица', () => {
    expect(parseMatchesPerTeam('')).toBeNull();
    expect(parseMatchesPerTeam('   ')).toBeNull();
  });

  it('нечисловой ввод тоже ничего не подставляет', () => {
    expect(parseMatchesPerTeam('abc')).toBeNull();
  });

  it('обычное число проходит как есть', () => {
    expect(parseMatchesPerTeam('9')).toBe(9);
  });

  it('обрезает по границам, которые принимает сервер', () => {
    expect(parseMatchesPerTeam('0')).toBe(1);
    expect(parseMatchesPerTeam('-3')).toBe(1);
    expect(parseMatchesPerTeam('99')).toBe(20);
  });

  it('дробное усекает', () => {
    expect(parseMatchesPerTeam('4.7')).toBe(4);
  });
});
