import { describe, it, expect, beforeAll } from 'vitest';
import { signSession, verifySession } from '@/lib/auth/session';

beforeAll(() => {
  process.env.SESSION_SECRET = 'test-secret-that-is-long-enough-32chars';
});

describe('session', () => {
  it('подписывает и разбирает токен', () => {
    const token = signSession('admin');
    expect(verifySession(token)).toEqual({ username: 'admin' });
  });

  it('отвергает подделанный токен', () => {
    const token = signSession('admin');
    const tampered = token.replace('admin', 'hacker');
    expect(verifySession(tampered)).toBeNull();
  });

  it('отвергает мусор', () => {
    expect(verifySession('не-токен')).toBeNull();
  });

  it('отвергает просроченный токен', () => {
    const token = signSession('admin', -1000);
    expect(verifySession(token)).toBeNull();
  });
});
