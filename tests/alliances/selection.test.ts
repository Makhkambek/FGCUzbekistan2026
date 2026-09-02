import { describe, it, expect } from 'vitest';
import { initialSelection, nextPicker, applyPick, PICK_ORDER } from '@/lib/alliances/selection';

// Команды по рейтингу: 1 — первая, 12 — последняя.
const ranked = Array.from({ length: 12 }, (_, i) => i + 1);

describe('initialSelection', () => {
  it('капитанами становятся первые три команды', () => {
    expect(initialSelection(ranked).map((a) => a.captain)).toEqual([1, 2, 3]);
  });
});

describe('PICK_ORDER', () => {
  it('идёт змейкой', () => expect(PICK_ORDER).toEqual([0, 1, 2, 2, 1, 0]));
});

describe('applyPick', () => {
  it('добавляет выбранную команду в альянс текущего капитана', () => {
    const s = applyPick(initialSelection(ranked), ranked, 5);
    expect(s[0].picks).toEqual([5]);
    expect(nextPicker(s)).toBe(1);
  });

  it('нельзя выбрать уже занятую команду', () => {
    const s = applyPick(initialSelection(ranked), ranked, 5);
    expect(() => applyPick(s, ranked, 5)).toThrow(/уже в альянсе/i);
  });

  it('нельзя выбрать самого себя', () => {
    expect(() => applyPick(initialSelection(ranked), ranked, 1)).toThrow(/уже в альянсе/i);
  });

  it('капитан выбрал нижестоящего капитана — тот уходит к нему, капитанство вниз', () => {
    // Альянс 1 (капитан 1) выбирает капитана 3.
    const s = applyPick(initialSelection(ranked), ranked, 3);
    expect(s[0].picks).toEqual([3]);
    expect(s[2].captain).toBe(4); // освободившееся капитанство ушло следующей свободной команде
    expect(s.map((a) => a.seed)).toEqual([1, 2, 3]);
  });

  it('нельзя выбрать капитана более высокого альянса', () => {
    // Ход альянса 1; проверяем запрет с позиции альянса 2 после первого выбора.
    let s = applyPick(initialSelection(ranked), ranked, 5); // альянс 1 берёт 5
    expect(() => applyPick(s, ranked, 1)).toThrow(/уже в альянсе/i);
  });

  it('после шести выборов очередь заканчивается', () => {
    let s = initialSelection(ranked);
    for (const t of [5, 6, 7, 8, 9, 10]) s = applyPick(s, ranked, t);
    expect(nextPicker(s)).toBeNull();
    expect(s.map((a) => a.picks.length)).toEqual([2, 2, 2]);
  });

  it('змейка: второй круг идёт в обратном порядке', () => {
    let s = initialSelection(ranked);
    s = applyPick(s, ranked, 5); // альянс 1
    s = applyPick(s, ranked, 6); // альянс 2
    s = applyPick(s, ranked, 7); // альянс 3
    s = applyPick(s, ranked, 8); // снова альянс 3
    expect(s[2].picks).toEqual([7, 8]);
  });
});
