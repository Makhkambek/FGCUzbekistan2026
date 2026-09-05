/**
 * «Очистить ивент» — одна кнопка вместо четырёх экранов.
 *
 * Чтобы начать турнир заново, оператор снимал результат у каждого сыгранного
 * матча, удалял плей-офф, распускал альянсы и только потом сбрасывал
 * расписание — в любом другом порядке каждый шаг отвечал 409. Здесь чистая
 * часть: слово-подтверждение и сводка того, что ушло. Команды остаются.
 */
export const CLEAR_EVENT_PHRASE = 'CLEAR';

/** Слово из диалога подтверждения: регистр и пробелы по краям не важны, всё остальное — отказ. */
export function clearEventConfirmed(input: string | null | undefined): boolean {
  return (input ?? '').trim().toUpperCase() === CLEAR_EVENT_PHRASE;
}

export interface ClearedCounts {
  qualification: number;
  playoff: number;
  alliances: number;
  skillsAttempts: number;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Что именно удалено — нули не перечисляются, чтобы сводка читалась, а не считалась. */
export function clearEventSummary(c: ClearedCounts): string {
  const parts: string[] = [];
  if (c.qualification) parts.push(plural(c.qualification, 'qualification match', 'qualification matches'));
  if (c.playoff) parts.push(plural(c.playoff, 'playoff match', 'playoff matches'));
  if (c.alliances) parts.push(plural(c.alliances, 'alliance'));
  if (c.skillsAttempts) parts.push(plural(c.skillsAttempts, 'skills attempt'));

  if (parts.length === 0) return 'Nothing to clear — the event was already empty. Teams are untouched.';
  const list = parts.length > 1
    ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
    : parts[0];
  return `Event cleared — ${list} deleted. Teams are untouched.`;
}
