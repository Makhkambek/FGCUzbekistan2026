import { NextRequest, NextResponse } from 'next/server';
import { requireSessionApi } from '@/lib/auth/require-session';
import { saveAttemptResult, resetAttemptResult, setAttemptAlliance } from '@/lib/db/skills';
import { getDisplayState, setDisplayState } from '@/lib/db/display';
import { skillsResultSchema, skillsAllianceSchema } from '@/lib/validation';

function attemptId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

  const id = attemptId((await ctx.params).id);
  if (id === null) return NextResponse.json({ error: 'Invalid attempt id' }, { status: 400 });

  const parsed = skillsResultSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid attempt data' }, { status: 400 });

  if (!await saveAttemptResult(id, parsed.data)) {
    return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
  }

  // Same rule as a match: scoring what is live on the projector flips it to
  // the result screen, and scoring anything else leaves the screen alone.
  const state = await getDisplayState();
  if (state.phase === 'live' && state.skillsAttemptId === id) {
    await setDisplayState('result', null, id);
  }
  return NextResponse.json({ ok: true });
}

/** Which side of the field this team plays from — the operator's choice. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

  const id = attemptId((await ctx.params).id);
  if (id === null) return NextResponse.json({ error: 'Invalid attempt id' }, { status: 400 });

  const parsed = skillsAllianceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid alliance' }, { status: 400 });

  if (!await setAttemptAlliance(id, parsed.data.alliance)) {
    return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

  const id = attemptId((await ctx.params).id);
  if (id === null) return NextResponse.json({ error: 'Invalid attempt id' }, { status: 400 });

  if (!await resetAttemptResult(id)) {
    return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
  }

  const state = await getDisplayState();
  if (state.skillsAttemptId === id) await setDisplayState('standings', null, null);
  return NextResponse.json({ ok: true });
}
