import { describe, it, expect } from 'vitest';
import { generateSchedule } from '@/lib/schedule/generate';

const teams = Array.from({ length: 12 }, (_, i) => i + 1);

describe('generateSchedule', () => {
  it('требует минимум шесть команд', () => {
    expect(() => generateSchedule([1, 2, 3, 4, 5], 3, 42)).toThrow(/минимум 6/i);
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
});
