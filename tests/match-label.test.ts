import { describe, it, expect } from 'vitest';
import { matchLabel } from '@/lib/match-label';

describe('matchLabel', () => {
  it('квалификация — Q и номер', () => {
    expect(matchLabel('qualification', 1)).toBe('Q1');
    expect(matchLabel('qualification', 12)).toBe('Q12');
  });

  // Буквы P на турнире не объявляют — матчи плей-оффа называют словом.
  it('плей-офф пишется словом', () => {
    expect(matchLabel('playoff', 1)).toBe('Match 1');
    expect(matchLabel('playoff', 3)).toBe('Match 3');
  });

  it('в плей-оффе нет буквенного префикса вовсе', () => {
    expect(matchLabel('playoff', 2)).not.toContain('P2');
  });
});
