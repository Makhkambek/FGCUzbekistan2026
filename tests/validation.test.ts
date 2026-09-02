import { describe, it, expect } from 'vitest';
import { matchResultSchema, teamSchema, scheduleParamsSchema } from '@/lib/validation';

const validResult = {
  suppressionRed: 100, suppressionBlue: 80, extinguisher: 40,
  climbRed: ['zone3', 'zone1', 'none'], climbBlue: ['contact', 'none', 'none'],
  partnerClimbRed: 1, partnerClimbBlue: 0,
  minorFoulsRed: 0, majorFoulsRed: 0, minorFoulsBlue: 1, majorFoulsBlue: 0,
  cardRed: ['none', 'none', 'yellow'], cardBlue: ['none', 'none', 'none'],
};

describe('matchResultSchema', () => {
  it('пропускает корректный результат', () => {
    expect(matchResultSchema.parse(validResult)).toBeTruthy();
  });

  it('отвергает отрицательный suppression', () => {
    expect(() => matchResultSchema.parse({ ...validResult, suppressionRed: -1 })).toThrow();
  });

  it('отвергает больше 500 wildfire', () => {
    expect(() => matchResultSchema.parse({ ...validResult, extinguisher: 501 })).toThrow();
  });

  it('отвергает неизвестную позицию залезания', () => {
    expect(() => matchResultSchema.parse({ ...validResult, climbRed: ['zone4', 'none', 'none'] })).toThrow();
  });

  it('требует ровно три позиции на альянс', () => {
    expect(() => matchResultSchema.parse({ ...validResult, climbRed: ['none', 'none'] })).toThrow();
  });

  it('отвергает больше двух partner climb', () => {
    expect(() => matchResultSchema.parse({ ...validResult, partnerClimbRed: 3 })).toThrow();
  });
});

describe('teamSchema', () => {
  it('требует непустое имя', () => expect(() => teamSchema.parse({ name: '' })).toThrow());
  it('обрезает пробелы', () => expect(teamSchema.parse({ name: '  Alpha  ' }).name).toBe('Alpha'));
});

describe('scheduleParamsSchema', () => {
  it('пропускает разумные значения', () =>
    expect(scheduleParamsSchema.parse({ matchesPerTeam: 5, seed: 42 })).toBeTruthy());
  it('отвергает ноль матчей на команду', () =>
    expect(() => scheduleParamsSchema.parse({ matchesPerTeam: 0, seed: 42 })).toThrow());
});
