import { NextResponse } from 'next/server';
import { requireSessionApi } from '@/lib/auth/require-session';
import { setDisplayState } from '@/lib/db/display';

export async function POST() {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

  await setDisplayState('standings', null);
  return NextResponse.json({ ok: true });
}
