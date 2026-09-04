import { describe, it, expect } from 'vitest';
import { pickNextMatch } from '@/lib/next-match';
import type { NextMatchCandidate } from '@/lib/next-match';

const m = (number: number, phase: 'qualification' | 'playoff', played = false): NextMatchCandidate =>
  ({ id: number * 10 + (phase === 'playoff' ? 1 : 0), number, phase, played });

describe('pickNextMatch', () => {
  it('в квалификации берёт следующий несыгранный по номеру', () => {
    const next = pickNextMatch(
      [m(1, 'qualification', true), m(2, 'qualification'), m(3, 'qualification')],
      { phase: 'qualification', number: 1 }, false);
    expect(next?.number).toBe(2);
  });

  it('не предлагает матч, который уже на экране', () => {
    const next = pickNextMatch(
      [m(1, 'qualification'), m(2, 'qualification', true)],
      { phase: 'qualification', number: 1 }, false);
    expect(next).toBeNull();
  });

  it('когда всё сыграно — ничего', () => {
    expect(pickNextMatch([m(1, 'qualification', true)], null, false)).toBeNull();
  });

  it('пустой список не роняет', () => {
    expect(pickNextMatch([], null, false)).toBeNull();
  });

  // Экран проектора анонсирует «дальше». Пока идёт плей-офф, зал должен
  // слышать только про плей-офф.
  describe('когда плей-офф уже существует', () => {
    it('анонсирует матч плей-оффа, а не оставшуюся квалификацию', () => {
      const next = pickNextMatch(
        [m(7, 'qualification'), m(1, 'playoff'), m(2, 'playoff')], null, true);
      expect(next?.phase).toBe('playoff');
      expect(next?.number).toBe(1);
    });

    // Тот самый случай: плей-офф доигран, а какой-то квал-матч остался
    // несыгранным — например, судья сбросил его результат, чтобы исправить
    // ошибку. Раньше проектор на церемонии закрытия начинал писать «дальше Q7».
    it('доигранный плей-офф не откатывается на брошенный квал-матч', () => {
      const next = pickNextMatch(
        [m(7, 'qualification'), m(1, 'playoff', true), m(2, 'playoff', true)], null, true);
      expect(next).toBeNull();
    });

    it('всё сыграно и в плей-оффе, и в квалификации — ничего', () => {
      const next = pickNextMatch(
        [m(7, 'qualification', true), m(1, 'playoff', true)], null, true);
      expect(next).toBeNull();
    });
  });

  it('до создания плей-оффа квалификация анонсируется как обычно', () => {
    const next = pickNextMatch([m(7, 'qualification')], null, false);
    expect(next?.number).toBe(7);
  });
});
