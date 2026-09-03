import crypto from 'node:crypto';

export { SESSION_COOKIE } from './constants';
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET must be set and at least 32 characters long');
  }
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function signSession(username: string, ttlMs: number = DEFAULT_TTL_MS): string {
  const payload = `${username}.${Date.now() + ttlMs}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySession(token: string): { username: string } | null {
  const macIdx = token.lastIndexOf('.');
  if (macIdx === -1) return null;

  const payload = token.slice(0, macIdx);
  const mac = token.slice(macIdx + 1);
  if (!payload || !mac) return null;

  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const idx = payload.lastIndexOf('.');
  if (idx === -1) return null;
  const username = payload.slice(0, idx);
  const expiresAt = Number(payload.slice(idx + 1));
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  return { username };
}
