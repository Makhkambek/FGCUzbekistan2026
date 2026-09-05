import { NextRequest, NextResponse } from 'next/server';
import { requireSessionApi } from '@/lib/auth/require-session';
import { clearEvent } from '@/lib/db/event';
import { clearEventConfirmed, clearEventSummary, CLEAR_EVENT_PHRASE } from '@/lib/event/clear';

/**
 * DELETE /api/admin/event?confirm=CLEAR — wipes the event, keeps the teams.
 *
 * Deliberately none of the 409 guards the individual resets have: this is
 * the endpoint that exists to get past them, when the whole event is being
 * started over. The confirmation word is the guard instead — a bare DELETE
 * from a stray script or a mistyped fetch must not take the day's results
 * with it.
 */
export async function DELETE(req: NextRequest) {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

  const confirm = new URL(req.url).searchParams.get('confirm');
  if (!clearEventConfirmed(confirm)) {
    return NextResponse.json(
      { error: `Type ${CLEAR_EVENT_PHRASE} to confirm clearing the event` }, { status: 400 });
  }

  const counts = await clearEvent();
  return NextResponse.json({ ok: true, counts, summary: clearEventSummary(counts) });
}
