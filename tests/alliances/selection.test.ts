import { describe, it, expect } from 'vitest';
import { initialSelection, isPickable, setPick, clearPick } from '@/lib/alliances/selection';

// Команды по рейтингу: 1 — первая, 12 — последняя.
const ranked = Array.from({ length: 12 }, (_, i) => i + 1);

describe('initialSelection', () => {
  it('капитанами становятся первые три команды', () => {
    expect(initialSelection(ranked).map((a) => a.captain)).toEqual([1, 2, 3]);
  });

  it('единственный пик каждого альянса изначально пуст', () => {
    // Альянс — капитан плюс одна команда: правило турнира от 4 сентября 2026,
    // когда финал перешёл на 2 робота против 2.
    expect(initialSelection(ranked).map((a) => a.picks)).toEqual([[null], [null], [null]]);
  });

  it('шести команд хватает на три альянса', () => {
    expect(initialSelection([1, 2, 3, 4, 5, 6]).map((a) => a.captain)).toEqual([1, 2, 3]);
  });

  it('пяти команд не хватает', () => {
    expect(() => initialSelection([1, 2, 3, 4, 5])).toThrow(/at least 6/i);
  });
});

describe('setPick — свободный порядок', () => {
  it('можно сразу выбрать пик для альянса 3, не трогая альянс 1', () => {
    const s = setPick(initialSelection(ranked), ranked, 3, 0, 7);
    expect(s.find((a) => a.seed === 3)!.picks).toEqual([7]);
    expect(s.find((a) => a.seed === 1)!.picks).toEqual([null]);
  });

  it('второго слота больше нет — пик у альянса один', () => {
    // @ts-expect-error the second slot is gone from the type as well
    expect(() => setPick(initialSelection(ranked), ranked, 1, 1, 5)).toThrow(/slot/i);
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

  // Решение от 4 сентября 2026: переманивания капитанов на этом турнире нет.
  // Раньше альянс с высоким посевом мог забрать капитана нижестоящего, и эти
  // тесты закрепляли именно то поведение. Правило изменилось — теперь они
  // закрепляют новое: капитан не выбирается вообще, ни свой, ни чужой.
  it('нельзя выбрать капитана вышестоящего альянса', () => {
    const s = initialSelection(ranked);
    expect(() => setPick(s, ranked, 2, 0, 1)).toThrow(/already in an alliance/i);
  });

  it('нельзя выбрать капитана нижестоящего альянса — переманивания больше нет', () => {
    const s = initialSelection(ranked);
    expect(() => setPick(s, ranked, 1, 0, 3)).toThrow(/already in an alliance/i);
  });

  it('капитанства остаются на месте после любых пиков', () => {
    let s = setPick(initialSelection(ranked), ranked, 1, 0, 4);
    s = setPick(s, ranked, 2, 0, 5);
    s = setPick(s, ranked, 3, 0, 6);
    expect(s.map((a) => a.captain)).toEqual([1, 2, 3]);
  });

  it('переназначить уже заполненный слот другой командой — старая команда освобождается', () => {
    let s = setPick(initialSelection(ranked), ranked, 1, 0, 5);
    s = setPick(s, ranked, 1, 0, 6);
    expect(s.find((a) => a.seed === 1)!.picks).toEqual([6]);
    // 5 снова свободна — её можно поставить в другой альянс.
    const s2 = setPick(s, ranked, 2, 0, 5);
    expect(s2.find((a) => a.seed === 2)!.picks).toEqual([5]);
  });

  it('повторно указать ту же команду в том же слоте — не ошибка', () => {
    let s = setPick(initialSelection(ranked), ranked, 1, 0, 5);
    s = setPick(s, ranked, 1, 0, 5);
    expect(s.find((a) => a.seed === 1)!.picks).toEqual([5]);
  });

  it('во втором круге доступны только те, кого ещё не разобрали', () => {
    // Первый круг: 1, 2, 3 — капитаны, разобрали 4, 5, 6.
    let s = setPick(initialSelection(ranked), ranked, 1, 0, 4);
    s = setPick(s, ranked, 2, 0, 5);
    s = setPick(s, ranked, 3, 0, 6);
    for (const seed of [1, 2, 3]) {
      const available = ranked.filter((id) => isPickable(s, seed, id));
      expect(available).toEqual([7, 8, 9, 10, 11, 12]);
    }
  });

  it('ни одна команда не попадает в два места', () => {
    let s = setPick(initialSelection(ranked), ranked, 1, 0, 4);
    s = setPick(s, ranked, 2, 0, 5);
    s = setPick(s, ranked, 3, 0, 6);

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
    expect(s.find((a) => a.seed === 1)!.picks).toEqual([null]);
  });

  it('очищенная команда снова доступна для любого альянса', () => {
    let s = setPick(initialSelection(ranked), ranked, 1, 0, 5);
    s = clearPick(s, 1, 0);
    expect(isPickable(s, 2, 5)).toBe(true);
  });

  it('очистка слота не трогает капитанов', () => {
    let s = setPick(initialSelection(ranked), ranked, 1, 0, 7);
    s = clearPick(s, 1, 0);
    expect(s.map((a) => a.captain)).toEqual([1, 2, 3]);
  });
});

// isPickable должен согласовываться с тем, что реально принимает и отклоняет
// setPick — иначе список в интерфейсе будет врать о том, что можно нажать.
describe('isPickable — согласованность с setPick', () => {
  it('свободная команда — pickable', () => {
    expect(isPickable(initialSelection(ranked), 1, 5)).toBe(true);
  });

  it('капитан своего же альянса — не pickable', () => {
    expect(isPickable(initialSelection(ranked), 1, 1)).toBe(false);
  });

  it('капитан вышестоящего альянса — не pickable', () => {
    expect(isPickable(initialSelection(ranked), 2, 1)).toBe(false);
  });

  it('капитан нижестоящего альянса — тоже не pickable', () => {
    expect(isPickable(initialSelection(ranked), 1, 3)).toBe(false);
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
