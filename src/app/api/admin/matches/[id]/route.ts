import { NextRequest, NextResponse } from 'next/server';
import { requireSessionApi } from '@/lib/auth/require-session';
import { saveMatchResult } from '@/lib/db/matches';
import { getDisplayState, setDisplayState } from '@/lib/db/display';
import { matchResultSchema } from '@/lib/validation';

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid match id' }, { status: 400 });
  }

  const parsed = matchResultSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid match data' }, { status: 400 });
  }

  const updated = await saveMatchResult(id, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: 'Match not found — the schedule may have been regenerated' }, { status: 404 });
  }

  // Flip the public display to the result screen only if this match was the
  // one currently live — saving results for other matches (e.g. re-scoring an
  // older one) must not interrupt whatever is on screen right now.
  const displayState = await getDisplayState();
  if (displayState.phase === 'live' && displayState.matchId === id) {
    await setDisplayState('result', id);
  }

  return NextResponse.json({ ok: true });
}
