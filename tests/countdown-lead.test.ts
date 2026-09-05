import { describe, it, expect } from 'vitest';
import { matchClock, COUNTDOWN_MS, START_LEAD_MS } from '@/lib/match-clock';

/**
 * Судья жалуется: нажимаешь Start — и «3» проскакивает мгновенно.
 *
 * Причина не в самой цифре, а в запаздывании: экран узнаёт о старте только со
 * следующего опроса состояния (до секунды), и от трёхсекундного счёта залу
 * остаётся полторы. Лечится не растягиванием цифр, а запасом: матч
 * назначается дальше в будущее, чем длится показанный счёт, и «3» успевает
 * появиться на экране целиком, сколько бы ни занял опрос.
 */
describe('запас перед стартом матча', () => {
  it('матч назначается дальше, чем длится показанный счёт', () => {
    expect(START_LEAD_MS).toBeGreaterThan(COUNTDOWN_MS);
  });

  it('запаса хватает на секунду опроса дисплея и ещё на секунду сверху', () => {
    expect(START_LEAD_MS - COUNTDOWN_MS).toBeGreaterThanOrEqual(2000);
  });

  const START = 1_000_000;
  const at = (msBeforeStart: number) => matchClock(START, START - msBeforeStart);

  it('сразу после нажатия зал уже видит счёт, а не замерший 2:30', () => {
    expect(at(START_LEAD_MS).period).toBe('countdown');
    expect(at(START_LEAD_MS).label).toBe('3');
  });

  it('«3» держится на экране не меньше двух с половиной секунд', () => {
    for (const before of [START_LEAD_MS, START_LEAD_MS - 500, 3000, 2600]) {
      expect(at(before).label, `${before} мс до старта`).toBe('3');
    }
    expect(at(2500).label).toBe('3');
  });

  it('дальше счёт идёт как раньше: 2, 1, поле', () => {
    expect(at(1900).label).toBe('2');
    expect(at(900).label).toBe('1');
    expect(at(0).period).toBe('running');
  });

  it('экран, открытый посреди счёта, показывает ту же цифру, что и остальные', () => {
    // Ограничение счёта тремя секундами никуда не делось: сбитые часы
    // проектора не должны рисовать залу счёт от минут.
    expect(matchClock(START, START - 5 * 60 * 1000).label).toBe('3');
  });
});
