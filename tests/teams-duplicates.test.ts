import { describe, it, expect } from 'vitest';
import { findDuplicateName } from '@/lib/db/team-names';

// Найдено живым прогоном 3 сентября: два POST /api/admin/teams с одним и тем
// же именем создавали две команды (в схеме нет UNIQUE на teams.name).
// Двойной клик по «Add» на турнире = фантомная команда, которая потом
// попадает в расписание и в рейтинг.
describe('findDuplicateName', () => {
  it('пропускает новое имя', () => {
    expect(findDuplicateName(['Nukus Nova', 'Khiva Hawks'], 'Bukhara Bots')).toBeNull();
  });

  it('находит точный дубль', () => {
    expect(findDuplicateName(['Nukus Nova'], 'Nukus Nova')).toBe('Nukus Nova');
  });

  it('находит дубль независимо от регистра', () => {
    expect(findDuplicateName(['Nukus Nova'], 'nukus nova')).toBe('Nukus Nova');
  });

  it('находит дубль независимо от пробелов по краям', () => {
    expect(findDuplicateName(['Nukus Nova'], '  Nukus Nova  ')).toBe('Nukus Nova');
  });

  it('на пустом списке дублей нет', () => {
    expect(findDuplicateName([], 'Nukus Nova')).toBeNull();
  });
});
