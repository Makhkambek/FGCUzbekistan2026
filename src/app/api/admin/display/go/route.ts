import { NextRequest, NextResponse } from 'next/server';
import { requireSessionApi } from '@/lib/auth/require-session';
import { startMatchClock } from '@/lib/db/display';
import { displayStartSchema } from '@/lib/validation';

/**
 * Starts the clock on the match already previewed on the display.
 *
 * Separate from /display/start (which only puts the match on screen) so the
 * referee can line the teams up, let the hall read the alliances, and only
 * then start the 3-2-1 — the two used to be one button, and the clock began
 * running while robots were still being placed on the field.
 */
export async function POST(req: NextRequest) {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

  const parsed = displayStartSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid match id' }, { status: 400 });
  }

  if (!await startMatchClock(parsed.data.matchId)) {
    return NextResponse.json(
      { error: 'Put the match on the display first — the clock starts what is on screen' },
      { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
