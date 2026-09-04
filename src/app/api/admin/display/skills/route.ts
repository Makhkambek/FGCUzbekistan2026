import { NextRequest, NextResponse } from 'next/server';
import { requireSessionApi } from '@/lib/auth/require-session';
import { getAttempt } from '@/lib/db/skills';
import { setDisplayState } from '@/lib/db/display';
import { displayStartSchema } from '@/lib/validation';

/** Puts a skills attempt on the projector, clock stopped — the preview step. */
export async function POST(req: NextRequest) {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

  const parsed = displayStartSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid attempt id' }, { status: 400 });

  const attempt = await getAttempt(parsed.data.matchId);
  if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });

  await setDisplayState('live', null, attempt.id);
  return NextResponse.json({ ok: true });
}
