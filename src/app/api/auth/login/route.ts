import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { findUserByUsername } from '@/lib/db/users';
import { verifyPassword } from '@/lib/auth/password';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { checkRateLimit, recordFailure, resetRateLimit } from '@/lib/auth/rate-limit';

const schema = z.object({ username: z.string().min(1).max(64), password: z.string().min(1).max(200) });

// Used to compare against when the username doesn't exist, so that an unknown
// username costs the same wall time as a wrong password for a real one — otherwise
// the missing bcrypt.compare() call becomes a timing side-channel for username enumeration.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('fgc-scoring-timing-safety-dummy', 12);

// No reverse proxy sits in front of this deployment, so a network header like
// x-forwarded-for is not a safe rate-limit key (browsers never send it, and an
// attacker can forge a fresh one on every request). Key on the attempted
// username instead — it protects each account without letting one judge's
// typo lock out everyone else.
function rateLimitKey(parsed: ReturnType<typeof schema.safeParse>): string {
  return parsed.success ? parsed.data.username.toLowerCase() : '<malformed>';
}

function isHttps(req: NextRequest): boolean {
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (forwardedProto) return forwardedProto === 'https';
  return req.nextUrl.protocol === 'https:';
}

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  const key = rateLimitKey(parsed);

  const limit = checkRateLimit(key);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Слишком много попыток. Попробуйте позже.' }, { status: 429 });
  }

  if (!parsed.success) {
    recordFailure(key);
    return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 });
  }

  const user = await findUserByUsername(parsed.data.username);
  const ok = await verifyPassword(parsed.data.password, user ? user.password_hash : DUMMY_PASSWORD_HASH);
  if (!user || !ok) {
    recordFailure(key);
    return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 });
  }

  resetRateLimit(key);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, signSession(user.username), {
    httpOnly: true, sameSite: 'strict', path: '/',
    secure: isHttps(req), maxAge: 12 * 60 * 60,
  });
  return res;
}
