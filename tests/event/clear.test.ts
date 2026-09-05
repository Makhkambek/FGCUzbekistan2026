import { describe, it, expect } from 'vitest';
import { clearEventConfirmed, clearEventSummary, CLEAR_EVENT_PHRASE } from '@/lib/event/clear';

/**
 * «Очисти ивент» — одна кнопка вместо четырёх экранов: до неё, чтобы начать
 * турнир заново, оператор снимал результаты у каждого сыгранного матча,
 * удалял плей-офф, распускал альянсы и только потом сбрасывал расписание —
 * в другом порядке каждый шаг отвечал 409. Команды при этом остаются.
 */
describe('подтверждение очистки', () => {
  it('фраза — CLEAR, ровно одно слово', () => {
    expect(CLEAR_EVENT_PHRASE).toBe('CLEAR');
  });

  it('принимает фразу с пробелами по краям и в любом регистре', () => {
    expect(clearEventConfirmed('CLEAR')).toBe(true);
    expect(clearEventConfirmed('  clear ')).toBe(true);
    expect(clearEventConfirmed('Clear')).toBe(true);
  });

  it('отвергает всё остальное — пустую строку, отмену диалога, похожие слова', () => {
    expect(clearEventConfirmed('')).toBe(false);
    expect(clearEventConfirmed(null)).toBe(false);
    expect(clearEventConfirmed('CLEA')).toBe(false);
    expect(clearEventConfirmed('CLEAR EVENT')).toBe(false);
    expect(clearEventConfirmed('yes')).toBe(false);
  });
});

describe('сводка после очистки — оператор видит, что именно ушло', () => {
  it('перечисляет всё, что удалено, и напоминает, что команды остались', () => {
    const text = clearEventSummary({ qualification: 16, playoff: 3, alliances: 4, skillsAttempts: 5 });
    expect(text).toMatch(/16 qualification matches/);
    expect(text).toMatch(/3 playoff matches/);
    expect(text).toMatch(/4 alliances/);
    expect(text).toMatch(/5 skills attempts/);
    expect(text).toMatch(/teams/i);
  });

  it('не упоминает то, чего не было', () => {
    const text = clearEventSummary({ qualification: 16, playoff: 0, alliances: 0, skillsAttempts: 0 });
    expect(text).toMatch(/16 qualification matches/);
    expect(text).not.toMatch(/playoff/);
    expect(text).not.toMatch(/alliance/);
    expect(text).not.toMatch(/skills/);
  });

  it('единственное число без «s»', () => {
    const text = clearEventSummary({ qualification: 1, playoff: 1, alliances: 1, skillsAttempts: 1 });
    expect(text).toMatch(/1 qualification match\b/);
    expect(text).toMatch(/1 playoff match\b/);
    expect(text).toMatch(/1 alliance\b/);
    expect(text).toMatch(/1 skills attempt\b/);
  });

  it('пустой ивент — говорит, что удалять было нечего, а не «удалено 0»', () => {
    const text = clearEventSummary({ qualification: 0, playoff: 0, alliances: 0, skillsAttempts: 0 });
    expect(text).toMatch(/nothing to clear/i);
    expect(text).not.toMatch(/\b0\b/);
  });
});
