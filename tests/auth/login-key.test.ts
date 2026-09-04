import { describe, it, expect } from 'vitest';
import { normalizeLoginKey, rateLimitKeyForUserId } from '@/lib/auth/login-key';

// MySQL compares `username = ?` under utf8mb4_unicode_ci, which is not only
// case-insensitive but accent-insensitive: 'ádmin' resolves to the row stored
// as 'admin'. The rate limiter used to key on plain toLowerCase(), so every
// diacritic spelling got its own five-attempt budget while the DB kept
// handing back the same real account — unlimited password guessing.
describe('normalizeLoginKey', () => {
  it('складывает регистр', () => {
    expect(normalizeLoginKey('ADMIN')).toBe(normalizeLoginKey('admin'));
  });

  it('складывает диакритику — так же, как это делает utf8mb4_unicode_ci', () => {
    for (const spelling of ['ádmin', 'àdmin', 'âdmin', 'ãdmin', 'ǎdmin', 'AdmÍn']) {
      expect(normalizeLoginKey(spelling)).toBe(normalizeLoginKey('admin'));
    }
  });

  it('складывает полноширинные формы', () => {
    expect(normalizeLoginKey('ａｄｍｉｎ')).toBe(normalizeLoginKey('admin'));
  });

  it('не склеивает разные имена', () => {
    expect(normalizeLoginKey('admin')).not.toBe(normalizeLoginKey('admin2'));
  });
});

// Normalisation is a best effort — utf8mb4_unicode_ci has equivalences it does
// not cover ('ß' = 'ss'). Once the row is known, its id is the exact thing the
// DB matched on, so that is what the limiter counts against.
describe('rateLimitKeyForUserId', () => {
  it('одна и та же учётка — один и тот же ключ, как её ни напиши', () => {
    expect(rateLimitKeyForUserId(7)).toBe(rateLimitKeyForUserId(7));
  });

  it('разные учётки — разные ключи', () => {
    expect(rateLimitKeyForUserId(7)).not.toBe(rateLimitKeyForUserId(8));
  });

  it('не пересекается с ключом по имени', () => {
    expect(rateLimitKeyForUserId(7)).not.toBe(normalizeLoginKey('7'));
  });
});
