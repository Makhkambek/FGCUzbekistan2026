import { describe, it, expect } from 'vitest';
import { qualificationBlockReason } from '@/lib/alliances/readiness';

describe('qualificationBlockReason', () => {
  it('квалификация доиграна — ничего не мешает', () => {
    expect(qualificationBlockReason({ total: 14, played: 14 })).toBeNull();
  });

  it('остались несыгранные матчи — называет, сколько именно', () => {
    const reason = qualificationBlockReason({ total: 14, played: 10 });
    expect(reason).toContain('4');
    expect(reason).toMatch(/qualification/i);
  });

  it('один оставшийся матч — единственное число', () => {
    expect(qualificationBlockReason({ total: 14, played: 13 })).toMatch(/1 qualification match /);
  });

  // Пустое расписание формально «доиграно»: 0 из 0. Сажать альянсы по рейтингу,
  // которого не существует, нельзя.
  it('расписания ещё нет — тоже отказ', () => {
    expect(qualificationBlockReason({ total: 0, played: 0 })).toMatch(/no qualification schedule/i);
  });
});
