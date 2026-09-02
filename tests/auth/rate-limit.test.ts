import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, recordFailure, resetRateLimit } from '@/lib/auth/rate-limit';

beforeEach(() => resetRateLimit('1.2.3.4'));

describe('rate limit', () => {
  it('пропускает первые пять попыток', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit('1.2.3.4').allowed).toBe(true);
      recordFailure('1.2.3.4');
    }
    expect(checkRateLimit('1.2.3.4').allowed).toBe(false);
  });

  it('разблокирует через 30 минут', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) recordFailure('1.2.3.4', t0);
    expect(checkRateLimit('1.2.3.4', t0).allowed).toBe(false);
    expect(checkRateLimit('1.2.3.4', t0 + 31 * 60_000).allowed).toBe(true);
  });

  it('успешный вход сбрасывает счётчик', () => {
    for (let i = 0; i < 5; i++) recordFailure('1.2.3.4');
    resetRateLimit('1.2.3.4');
    expect(checkRateLimit('1.2.3.4').allowed).toBe(true);
  });
});
