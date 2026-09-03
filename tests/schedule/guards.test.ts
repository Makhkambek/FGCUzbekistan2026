import { describe, it, expect } from 'vitest';
import { scheduleResetBlockReason } from '@/lib/schedule/guards';

// Найдено живым прогоном 3 сентября: Reset расписания стирал все матчи
// вместе с уже введёнными результатами и отвечал 200 OK. Проверка на
// played стояла только в POST (перегенерация), а в DELETE (Reset) — нет,
// хотя удаляют они одно и то же.
describe('scheduleResetBlockReason', () => {
  const clean = { hasPlayedMatches: false, hasAlliances: false, hasPlayoffMatches: false };

  it('на чистой сетке разрешает сброс', () => {
    expect(scheduleResetBlockReason(clean)).toBeNull();
  });

  it('БЛОКИРУЕТ сброс, если есть хоть один сыгранный матч', () => {
    expect(scheduleResetBlockReason({ ...clean, hasPlayedMatches: true })).toMatch(/played/i);
  });

  it('блокирует сброс при существующих альянсах', () => {
    expect(scheduleResetBlockReason({ ...clean, hasAlliances: true })).toMatch(/alliance/i);
  });

  it('блокирует сброс при существующем плей-оффе', () => {
    expect(scheduleResetBlockReason({ ...clean, hasPlayoffMatches: true })).toMatch(/playoff/i);
  });

  it('сыгранные матчи важнее: причина называет их даже вместе с альянсами', () => {
    const reason = scheduleResetBlockReason({
      hasPlayedMatches: true, hasAlliances: true, hasPlayoffMatches: true,
    });
    expect(reason).toMatch(/played/i);
  });
});
