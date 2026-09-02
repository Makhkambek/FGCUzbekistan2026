import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { findUserByUsername } from '@/lib/db/users';
import { verifyPassword } from '@/lib/auth/password';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { checkRateLimit, recordFailure, resetRateLimit } from '@/lib/auth/rate-limit';

const schema = z.object({ username: z.string().min(1).max(64), password: z.string().min(1).max(200) });

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';

  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Слишком много попыток. Попробуйте позже.' }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    recordFailure(ip);
    return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 });
  }

  const user = await findUserByUsername(parsed.data.username);
  const ok = user ? await verifyPassword(parsed.data.password, user.password_hash) : false;
  if (!user || !ok) {
    recordFailure(ip);
    return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 });
  }

  resetRateLimit(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, signSession(user.username), {
    httpOnly: true, sameSite: 'strict', path: '/',
    secure: process.env.NODE_ENV === 'production', maxAge: 12 * 60 * 60,
  });
  return res;
}
