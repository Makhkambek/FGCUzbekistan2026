import { describe, it, expect } from 'vitest';
import { generateSchedule, scheduleShape, evenMatchesPerTeam } from '@/lib/schedule/generate';

const teams = Array.from({ length: 12 }, (_, i) => i + 1);

describe('generateSchedule', () => {
  it('требует минимум шесть команд', () => {
    expect(() => generateSchedule([1, 2, 3, 4, 5], 3, 42)).toThrow(/at least 6 teams/i);
  });

  it('в каждом альянсе ровно три команды', () => {
    for (const m of generateSchedule(teams, 5, 42)) {
      expect(m.red).toHaveLength(3);
      expect(m.blue).toHaveLength(3);
    }
  });

  it('команда не встречается дважды в одном матче', () => {
    for (const m of generateSchedule(teams, 5, 42)) {
      expect(new Set([...m.red, ...m.blue]).size).toBe(6);
    }
  });

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
    // 13 команд * 5 матчей/команду / 6 команд/матч = 10.83..., округлено до 10 матчей
    // 10 матчей * 6 команд/матч = 60 появлений
    // 60 появлений / 13 команд = 4.6... появлений/команду
    // Команды должны иметь 4 или 5 появлений (в пределах ±1 от 5)
    const teams13 = Array.from({ length: 13 }, (_, i) => i + 1);
    const schedule = generateSchedule(teams13, 5, 42);
    const counts = new Map<number, number>();
    for (const m of schedule) {
      for (const t of [...m.red, ...m.blue]) counts.set(t, (counts.get(t) ?? 0) + 1);
      // Убедиться, что команда не встречается дважды в одном матче
      expect(new Set([...m.red, ...m.blue]).size).toBe(6);
    }
    for (const t of teams13) {
      expect(Math.abs((counts.get(t) ?? 0) - 5)).toBeLessThanOrEqual(1);
    }
  });
});

describe('generateSchedule — недобор матчей', () => {
  // Мануал §6.3: «Each team will play a set number of RANKING MATCHES».
  // Округление вниз давало командам МЕНЬШЕ матчей, чем запросил оператор,
  // а на 9 командах и одном матче — троим не доставалось ни одного.
  const countPerTeam = (teamIds: number[], perTeam: number, seed: number) => {
    const schedule = generateSchedule(teamIds, perTeam, seed);
    const counts = new Map(teamIds.map((id) => [id, 0]));
    for (const m of schedule) {
      for (const id of [...m.red, ...m.blue]) counts.set(id, counts.get(id)! + 1);
    }
    return [...counts.values()];
  };

  it('никто не играет меньше запрошенного, когда произведение не делится на 6', () => {
    for (const [teams, perTeam] of [[9, 1], [9, 5], [7, 1], [13, 5], [8, 5], [11, 3]] as const) {
      const ids = Array.from({ length: teams }, (_, i) => i + 1);
      const counts = countPerTeam(ids, perTeam, 42);
      expect(Math.min(...counts), `${teams} команд × ${perTeam}`).toBeGreaterThanOrEqual(perTeam);
    }
  });

  it('разброс между командами не больше одного матча', () => {
    const ids = Array.from({ length: 9 }, (_, i) => i + 1);
    const counts = countPerTeam(ids, 5, 7);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });
});

describe('scheduleShape — что реально получит оператор', () => {
  it('считает, сколько команд сыграет на матч больше', () => {
    // 13 команд по 8 матчей = 104 места, это 18 матчей (108 мест):
    // четырём командам достаётся девятая игра.
    expect(scheduleShape(13, 8)).toEqual({ totalMatches: 18, base: 8, withExtra: 4 });
    // 12 × 8 = 96 = ровно 16 матчей, всем поровну.
    expect(scheduleShape(12, 8)).toEqual({ totalMatches: 16, base: 8, withExtra: 0 });
  });

  it('подсказывает ближайшее число матчей, которое делится ровно', () => {
    expect(evenMatchesPerTeam(13, 8)).toBe(6);  // ближайшее к 8, а не 12
    expect(evenMatchesPerTeam(10, 8)).toBe(9);
    expect(evenMatchesPerTeam(12, 8)).toBeNull(); // уже ровно
  });
});
