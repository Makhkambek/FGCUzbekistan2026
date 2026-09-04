import { NextRequest, NextResponse } from 'next/server';
import { requireSessionApi } from '@/lib/auth/require-session';
import { upsertUser, countUsers } from '@/lib/db/users';
import { hashPassword } from '@/lib/auth/password';
import { accountSchema } from '@/lib/validation';

/** How many accounts exist — the admin page says so, and says nothing else. */
export async function GET() {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  return NextResponse.json({ users: await countUsers() });
}

/**
 * Creates a referee account or resets the password of one that exists.
 *
 * Signing in already requires an account, so this cannot be the way the first
 * one is made on a server nobody can sign into — that is what the session
 * secret is for, and whoever holds it can mint a session and call this. It is
 * the only route to an account on a deployed site: the production image has
 * no scripts in it.
 */
export async function POST(req: NextRequest) {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

  const parsed = accountSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'A name without spaces and a password of at least 12 characters' }, { status: 400 });
  }

  await upsertUser(parsed.data.username, await hashPassword(parsed.data.password));
  return NextResponse.json({ ok: true, username: parsed.data.username });
}
