import { NextRequest, NextResponse } from 'next/server';
import { requireSessionApi } from '@/lib/auth/require-session';
import { saveMatchResult } from '@/lib/db/matches';
import { matchResultSchema } from '@/lib/validation';

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Нет доступа' }, { status: 401 });

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Некорректный id матча' }, { status: 400 });
  }

  const parsed = matchResultSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Некорректные данные матча' }, { status: 400 });
  }

  await saveMatchResult(id, parsed.data);
  return NextResponse.json({ ok: true });
}
