import { NextRequest, NextResponse } from 'next/server';
import { requireSessionApi } from '@/lib/auth/require-session';
import { startSkillsClock } from '@/lib/db/display';
import { displayStartSchema } from '@/lib/validation';

/** Starts the 3-2-1 and the 2:30 on the skills attempt already on screen. */
export async function POST(req: NextRequest) {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

  const parsed = displayStartSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid attempt id' }, { status: 400 });

  if (!await startSkillsClock(parsed.data.matchId)) {
    return NextResponse.json(
      { error: 'Put the attempt on the display first — the clock starts what is on screen' },
      { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
