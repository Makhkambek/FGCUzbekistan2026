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

  // Раньше отрицательное «прошло» означало только сбитые часы и приводилось
  // к 2:30. Теперь старт назначается на несколько секунд вперёд ради 3-2-1,
  // поэтому будущий старт — это обратный счёт. Сильно сбитые часы всё равно
  // не сломают экран: счёт ограничен тремя секундами, а не минутами.
  it('часы клиента далеко впереди сервера — счёт не длиннее трёх секунд', () => {
    const c = matchClock(START, START - 5 * 60 * 1000);
    expect(c.period).toBe('countdown');
    expect(c.label).toBe('3');
    expect(c.remainingMs).toBe(MATCH_DURATION_MS);
  });
});

// Судья сначала выводит матч на экран (Preview), потом жмёт Start — и зал
// видит 3-2-1, прежде чем пойдут 2:30. Поэтому момент старта приходит из
// будущего, и отрицательное «прошло» больше не ошибка часов, а обратный счёт.
describe('matchClock — обратный счёт перед матчем', () => {
  const START = 1_000_000;

  it('за 3 секунды до старта показывает 3', () => {
    const c = matchClock(START, START - 3000);
    expect(c.period).toBe('countdown');
    expect(c.label).toBe('3');
  });

  it('за 2.4 секунды показывает 3, а не 2 — округление вверх', () => {
    expect(matchClock(START, START - 2400).label).toBe('3');
  });

  it('за секунду до старта показывает 1', () => {
    expect(matchClock(START, START - 900).label).toBe('1');
  });

  it('в момент старта обратный счёт кончается и идут 2:30', () => {
    const c = matchClock(START, START);
    expect(c.period).toBe('running');
    expect(c.label).toBe('2:30');
  });

  it('матч, выведенный на экран, но не запущенный, стоит на 2:30', () => {
    const c = matchClock(null, START);
    expect(c.period).toBe('pre');
    expect(c.label).toBe('2:30');
  });
});
