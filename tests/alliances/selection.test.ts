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

  // 6 сентября 2026, посреди турнира: переманивание капитанов возвращается.
  // 4 сентября его убрали, а на самом драфте капитан альянса 2 не смог взять
  // капитана альянса 3 — правило FIRST здесь всё-таки нужно. Вверх по посеву
  // по-прежнему нельзя: только альянс с более высоким посевом забирает
  // капитана нижестоящего.
  it('нельзя выбрать капитана вышестоящего альянса', () => {
    const s = initialSelection(ranked);
    expect(() => setPick(s, ranked, 2, 0, 1)).toThrow(/already in an alliance/i);
  });

  it('капитанства остаются на месте после пиков обычных команд', () => {
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

  it('капитан нижестоящего альянса — pickable, его можно переманить', () => {
    expect(isPickable(initialSelection(ranked), 1, 3, ranked)).toBe(true);
    expect(isPickable(initialSelection(ranked), 2, 3, ranked)).toBe(true);
  });

  it('капитан нижестоящего альянса, который уже сделал пик, — не pickable', () => {
    const s = setPick(initialSelection(ranked), ranked, 3, 0, 6);
    expect(isPickable(s, 2, 3, ranked)).toBe(false);
  });

  it('уже выбранный кем-то пик — не pickable', () => {
    const s = setPick(initialSelection(ranked), ranked, 1, 0, 5);
    expect(isPickable(s, 2, 5)).toBe(false);
  });

  it('полный перебор: там, где isPickable говорит true, setPick не бросает, где false — бросает', () => {
    const s = initialSelection(ranked);
    for (const seed of [1, 2, 3] as const) {
      for (const teamId of ranked) {
        const expected = isPickable(s, seed, teamId, ranked);
        if (expected) expect(() => setPick(s, ranked, seed, 0, teamId)).not.toThrow();
        else expect(() => setPick(s, ranked, seed, 0, teamId)).toThrow();
      }
    }
  });
});

// Правило FIRST: альянс с более высоким посевом может выбрать капитана
// нижестоящего. Тот уходит пиком, его альянс распускается, нижестоящие
// поднимаются на посев выше, а капитаном последнего альянса становится
// следующая по рейтингу свободная команда.
describe('setPick — переманивание капитана нижестоящего альянса', () => {
  it('капитан 2 берёт капитана 3 — капитаном альянса 3 становится 4-я команда рейтинга', () => {
    const s = setPick(initialSelection(ranked), ranked, 2, 0, 3);
    expect(s.map((a) => a.seed)).toEqual([1, 2, 3]);
    expect(s.map((a) => a.captain)).toEqual([1, 2, 4]);
    expect(s[1].picks).toEqual([3]);
    expect(s[2].picks).toEqual([null]);
  });

  it('капитан 1 берёт капитана 2 — альянс 3 поднимается на 2-й посев, новый 3-й — 4-я команда', () => {
    const s = setPick(initialSelection(ranked), ranked, 1, 0, 2);
    expect(s.map((a) => a.captain)).toEqual([1, 3, 4]);
    expect(s[0].picks).toEqual([2]);
  });

  it('поднимающийся альянс сохраняет свой пик', () => {
    let s = setPick(initialSelection(ranked), ranked, 3, 0, 6);
    s = setPick(s, ranked, 1, 0, 2);
    expect(s.map((a) => a.captain)).toEqual([1, 3, 4]);
    expect(s[1].picks).toEqual([6]);
  });

  it('новым капитаном становится лучшая по рейтингу СВОБОДНАЯ команда, а не просто 4-я', () => {
    let s = setPick(initialSelection(ranked), ranked, 1, 0, 4);
    s = setPick(s, ranked, 2, 0, 3);
    expect(s.map((a) => a.captain)).toEqual([1, 2, 5]);
  });

  it('капитана, чей альянс уже сделал пик, переманить нельзя — сначала снять его пик', () => {
    const s = setPick(initialSelection(ranked), ranked, 3, 0, 6);
    expect(() => setPick(s, ranked, 2, 0, 3)).toThrow(/already picked/i);
  });

  it('вверх по посеву по-прежнему нельзя', () => {
    const s = initialSelection(ranked);
    expect(() => setPick(s, ranked, 3, 0, 2)).toThrow(/already in an alliance/i);
  });

  it('шести команд хватает всегда: слот пикающего освобождается, и капитан для последнего альянса находится', () => {
    const six = [1, 2, 3, 4, 5, 6];
    let s = setPick(initialSelection(six), six, 1, 0, 4);
    s = setPick(s, six, 2, 0, 5);
    // Альянс 3 без пика; все, кроме 6, разобраны. Альянс 1 меняет свой пик 4 на капитана 3:
    // 4 освобождается, и лучшей свободной становится именно она, а не 6.
    const next = setPick(s, six, 1, 0, 3);
    expect(next.map((a) => a.captain)).toEqual([1, 2, 4]);
    expect(next[0].picks).toEqual([3]);
    expect(next[1].picks).toEqual([5]);
    expect(next[2].picks).toEqual([null]);
  });

  it('после переманивания ни одна команда не сидит в двух местах', () => {
    let s = setPick(initialSelection(ranked), ranked, 3, 0, 6);
    s = setPick(s, ranked, 1, 0, 2);
    s = setPick(s, ranked, 2, 0, 5);
    const seen = new Set<number>();
    for (const a of s) {
      for (const id of [a.captain, ...a.picks]) {
        if (id === null) continue;
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
    }
  });
});
