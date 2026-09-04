import { describe, it, expect } from 'vitest';
import { matchClock, MATCH_DURATION_MS, ENDGAME_MS } from '@/lib/match-clock';

const START = 1_000_000;
const at = (secondsIn: number) => matchClock(START, START + secondsIn * 1000);

describe('matchClock', () => {
  it('матч идёт 2:30', () => {
    expect(MATCH_DURATION_MS).toBe(150_000);
    expect(ENDGAME_MS).toBe(30_000);
  });

  it('до старта показывает полное время и не тикает', () => {
    const c = matchClock(null, START);
    expect(c.period).toBe('pre');
    expect(c.label).toBe('2:30');
  });

  it('в момент старта — 2:30', () => {
    expect(at(0).label).toBe('2:30');
    expect(at(0).period).toBe('running');
  });

  it('через минуту — 1:30', () => {
    expect(at(60).label).toBe('1:30');
    expect(at(60).period).toBe('running');
  });

  it('секунды показываются с ведущим нулём', () => {
    expect(at(145).label).toBe('0:05');
  });

  // Судья объявляет endgame на последних 30 секундах.
  it('за 31 секунду до конца это ещё не endgame', () => {
    expect(at(MATCH_DURATION_MS / 1000 - 31).period).toBe('running');
  });

  it('ровно за 30 секунд начинается endgame', () => {
    const c = at(120);
    expect(c.period).toBe('endgame');
    expect(c.label).toBe('0:30');
  });

  it('внутри endgame так и остаётся endgame', () => {
    expect(at(140).period).toBe('endgame');
  });

  it('на нуле матч закончен', () => {
    const c = at(150);
    expect(c.period).toBe('over');
    expect(c.label).toBe('0:00');
  });

  it('после конца время не уходит в минус', () => {
    const c = at(400);
    expect(c.label).toBe('0:00');
    expect(c.remainingMs).toBe(0);
    expect(c.period).toBe('over');
  });

  // Часы на ноутбуке с проектором могут отставать от сервера. Отрицательное
  // прошедшее время не должно показывать «2:31» и больше.
  it('часы клиента впереди сервера — время не превышает 2:30', () => {
    const c = matchClock(START, START - 5000);
    expect(c.label).toBe('2:30');
    expect(c.remainingMs).toBe(MATCH_DURATION_MS);
  });
});
