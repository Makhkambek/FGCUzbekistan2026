import { describe, it, expect } from 'vitest';
import { initialSelection, isPickable, isPoach, setPick, clearPick } from '@/lib/alliances/selection';

// Команды по рейтингу: 1 — первая, 12 — последняя.
const ranked = Array.from({ length: 12 }, (_, i) => i + 1);

describe('initialSelection', () => {
  it('капитанами становятся первые три команды', () => {
    expect(initialSelection(ranked).map((a) => a.captain)).toEqual([1, 2, 3]);
  });

  it('оба пика у каждого альянса изначально пустые слоты', () => {
    expect(initialSelection(ranked).map((a) => a.picks)).toEqual([[null, null], [null, null], [null, null]]);
  });
});

describe('setPick — свободный порядок', () => {
  it('можно сразу выбрать пик для альянса 3, не трогая альянс 1', () => {
    const s = setPick(initialSelection(ranked), ranked, 3, 0, 7);
    expect(s.find((a) => a.seed === 3)!.picks).toEqual([7, null]);
    expect(s.find((a) => a.seed === 1)!.picks).toEqual([null, null]);
  });

  it('внутри одного альянса можно сначала заполнить слот 2, потом слот 1', () => {
    let s = setPick(initialSelection(ranked), ranked, 1, 1, 5);
    expect(s.find((a) => a.seed === 1)!.picks).toEqual([null, 5]);
    s = setPick(s, ranked, 1, 0, 6);
    expect(s.find((a) => a.seed === 1)!.picks).toEqual([6, 5]);
  });

  it('нельзя выбрать команду не из рейтинга', () => {
    expect(() => setPick(initialSelection(ranked), ranked, 1, 0, 99)).toThrow(/not in the ranking/i);
  });

  it('нельзя выбрать уже занятую другим альянсом команду', () => {
    const s = setPick(initialSelection(ranked), ranked, 1, 0, 5);
    expect(() => setPick(s, ranked, 2, 0, 5)).toThrow(/already in an alliance/i);
  });

  it('нельзя выбрать капитана своего же альянса', () => {
    expect(() => setPick(initialSelection(ranked), ranked, 1, 0, 1)).toThrow(/captain of this alliance/i);
  });

  it('нельзя поймать капитана более высокого (или своего) по посеву альянса', () => {
    const s = initialSelection(ranked);
    // Альянс 2 не может поймать капитана альянса 1 (команда 1).
    expect(() => setPick(s, ranked, 2, 0, 1)).toThrow(/already in an alliance/i);
  });

  it('можно поймать капитана нижестоящего по посеву альянса — капитанство уходит следующему свободному', () => {
    // Альянс 1 ловит капитана альянса 3 (команда 3).
    const s = setPick(initialSelection(ranked), ranked, 1, 0, 3);
    expect(s.find((a) => a.seed === 1)!.picks).toEqual([3, null]);
    expect(s.find((a) => a.seed === 3)!.captain).toBe(4); // следующий свободный по рейтингу, не по индексу
  });

  it('переназначить уже заполненный слот другой командой — старая команда освобождается', () => {
    let s = setPick(initialSelection(ranked), ranked, 1, 0, 5);
    s = setPick(s, ranked, 1, 0, 6);
    expect(s.find((a) => a.seed === 1)!.picks).toEqual([6, null]);
    // 5 снова свободна — её можно поставить в другой альянс.
    const s2 = setPick(s, ranked, 2, 0, 5);
    expect(s2.find((a) => a.seed === 2)!.picks).toEqual([5, null]);
  });

  it('повторно указать ту же команду в том же слоте — не ошибка', () => {
    let s = setPick(initialSelection(ranked), ranked, 1, 0, 5);
    s = setPick(s, ranked, 1, 0, 5);
    expect(s.find((a) => a.seed === 1)!.picks).toEqual([5, null]);
  });

  it('двойное повышение капитанства работает независимо от порядка вызовов', () => {
    // Альянс 1 ловит капитана 3 → капитанство альянса 3 уходит 4.
    let s = setPick(initialSelection(ranked), ranked, 1, 0, 3);
    expect(s.find((a) => a.seed === 3)!.captain).toBe(4);
    // Альянс 2 ловит нового капитана альянса 3 (команда 4) → капитанство уходит 5.
    s = setPick(s, ranked, 2, 0, 4);
    expect(s.find((a) => a.seed === 3)!.captain).toBe(5);

    const allTeams = new Set<number>();
    for (const a of s) {
      expect(allTeams.has(a.captain)).toBe(false);
      allTeams.add(a.captain);
      for (const p of a.picks) {
        if (p === null) continue;
        expect(allTeams.has(p)).toBe(false);
        allTeams.add(p);
      }
    }
  });
});

describe('clearPick', () => {
  it('освобождает слот', () => {
    let s = setPick(initialSelection(ranked), ranked, 1, 0, 5);
    s = clearPick(s, 1, 0);
    expect(s.find((a) => a.seed === 1)!.picks).toEqual([null, null]);
  });

  it('очищенная команда снова доступна для любого альянса', () => {
    let s = setPick(initialSelection(ranked), ranked, 1, 0, 5);
    s = clearPick(s, 1, 0);
    expect(isPickable(s, 2, 5)).toBe(true);
  });

  it('известное ограничение: очистка слота с пойманным капитаном НЕ откатывает повышение капитанства', () => {
    let s = setPick(initialSelection(ranked), ranked, 1, 0, 3); // ловит капитана 3, капитанство уходит 4
    s = clearPick(s, 1, 0);
    expect(s.find((a) => a.seed === 3)!.captain).toBe(4); // остаётся 4, не откатывается на 3
  });
});

// isPickable/isPoach должны согласовываться с тем, что реально принимает и
// отклоняет setPick — иначе список в интерфейсе будет врать о том, что
// можно нажать.
describe('isPickable / isPoach — согласованность с setPick', () => {
  it('свободная команда — pickable, не poach', () => {
    const s = initialSelection(ranked);
    expect(isPickable(s, 1, 5)).toBe(true);
    expect(isPoach(s, 1, 5)).toBe(false);
  });

  it('капитан своего же альянса — не pickable, не poach', () => {
    const s = initialSelection(ranked);
    expect(isPickable(s, 1, 1)).toBe(false);
    expect(isPoach(s, 1, 1)).toBe(false);
  });

  it('капитан вышестоящего альянса — не pickable, не poach', () => {
    const s = initialSelection(ranked);
    expect(isPickable(s, 2, 1)).toBe(false);
    expect(isPoach(s, 2, 1)).toBe(false);
  });

  it('капитан нижестоящего альянса — pickable И poach', () => {
    const s = initialSelection(ranked);
    expect(isPickable(s, 1, 3)).toBe(true);
    expect(isPoach(s, 1, 3)).toBe(true);
  });

  it('уже выбранный кем-то пик — не pickable', () => {
    const s = setPick(initialSelection(ranked), ranked, 1, 0, 5);
    expect(isPickable(s, 2, 5)).toBe(false);
  });

  it('полный перебор: там, где isPickable говорит true, setPick не бросает, где false — бросает', () => {
    const s = initialSelection(ranked);
    for (const seed of [1, 2, 3] as const) {
      for (const teamId of ranked) {
        const expected = isPickable(s, seed, teamId);
        if (expected) expect(() => setPick(s, ranked, seed, 0, teamId)).not.toThrow();
        else expect(() => setPick(s, ranked, seed, 0, teamId)).toThrow();
      }
    }
  });
});
