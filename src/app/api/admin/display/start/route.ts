import { NextRequest, NextResponse } from 'next/server';
import { requireSessionApi } from '@/lib/auth/require-session';
import { getMatchById } from '@/lib/db/matches';
import { setDisplayState } from '@/lib/db/display';
import { displayStartSchema } from '@/lib/validation';

export async function POST(req: NextRequest) {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

  const parsed = displayStartSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid match id' }, { status: 400 });
  }

  const match = await getMatchById(parsed.data.matchId);
  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  await setDisplayState('live', match.id);
  return NextResponse.json({ ok: true });
}
