import { NextRequest, NextResponse } from 'next/server';
import { requireSessionApi } from '@/lib/auth/require-session';
import { latestSnapshot, countPlayed, restoreSnapshot } from '@/lib/db/snapshots';
import { restoreBlockReason } from '@/lib/snapshots';

/** What the schedule page needs to offer (or explain) the rollback. */
export async function GET() {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

  const snapshot = await latestSnapshot('qualification');
  const currentPlayed = await countPlayed('qualification');
  return NextResponse.json({
    snapshot,
    blockReason: restoreBlockReason({ snapshotExists: snapshot !== null, currentPlayed }),
  });
}

/**
 * Puts the qualification phase back exactly as it was before the last reset,
 * regeneration or cleared result — same matches, same ids, same scores.
 *
 * `?force=1` goes ahead even though results have been entered since. That is
 * the operator's call to make, and it is also how a run of resets is walked
 * back one step at a time: each restore lands on results that came from the
 * previous snapshot, which would otherwise look like new work to protect.
 */
export async function POST(req: NextRequest) {
  if (!await requireSessionApi()) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

  const force = new URL(req.url).searchParams.get('force') === '1';
  const snapshot = await latestSnapshot('qualification');
  const currentPlayed = await countPlayed('qualification');
  const blocked = restoreBlockReason({ snapshotExists: snapshot !== null, currentPlayed });
  // No snapshot is not something force can fix — there is nothing to restore.
  if (blocked && (!force || snapshot === null)) {
    return NextResponse.json({ error: blocked }, { status: 409 });
  }

  const restored = await restoreSnapshot(snapshot!.id);
  return NextResponse.json({ ok: true, matches: restored });
}
