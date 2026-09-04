import { describe, it, expect } from 'vitest';
import { accountSchema } from '@/lib/validation';

/**
 * The rules an account has to satisfy before it is written. They are the same
 * rules scripts/create-admin.ts enforces, moved somewhere the running site can
 * enforce them too — a new server has no way to run that script.
 */
describe('a referee account', () => {
  const ok = { username: 'admin', password: 'admin-fgc-2026' };

  it('is accepted with a name and a long enough password', () => {
    expect(accountSchema.safeParse(ok).success).toBe(true);
  });

  it('refuses a password under twelve characters', () => {
    expect(accountSchema.safeParse({ ...ok, password: 'short' }).success).toBe(false);
  });

  it('refuses an empty name', () => {
    expect(accountSchema.safeParse({ ...ok, username: '' }).success).toBe(false);
  });

  it('refuses a name with a space in it, so it can be typed the same way twice', () => {
    expect(accountSchema.safeParse({ ...ok, username: 'head referee' }).success).toBe(false);
  });

  it('keeps the name it was given, trimmed', () => {
    const parsed = accountSchema.parse({ ...ok, username: '  admin  ' });
    expect(parsed.username).toBe('admin');
  });
});
