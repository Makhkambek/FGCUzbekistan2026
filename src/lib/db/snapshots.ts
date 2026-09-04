import type { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import { getPool } from './pool';
import type { MatchRow } from './matches';

export type SnapshotReason = 'reset' | 'regenerate' | 'match-reset';
export type Phase = 'qualification' | 'playoff';

export interface SnapshotSummary {
  id: number;
  createdAt: number;
  phase: Phase;
  reason: SnapshotReason;
  matchCount: number;
  playedCount: number;
}

interface SnapshotRow extends RowDataPacket {
  id: number;
  created_at: Date;
  phase: Phase;
  reason: SnapshotReason;
  match_count: number;
  played_count: number;
  rows_json: MatchRow[] | string;
}

/** mysql2 gives JSON columns back parsed, but a driver upgrade could change that. */
function parseRows(value: MatchRow[] | string): MatchRow[] {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

/**
 * Copies a phase's matches before something destroys them.
 *
 * Takes the caller's connection so the copy and the deletion commit or roll
 * back together — a snapshot of a deletion that never happened would offer to
 * "restore" the schedule that is already there.
 */
export async function takeSnapshot(
  conn: PoolConnection, phase: Phase, reason: SnapshotReason,
): Promise<void> {
  const [rows] = await conn.execute<MatchRow[]>(
    'SELECT * FROM matches WHERE phase = ? ORDER BY match_number', [phase]);
  if (rows.length === 0) return;

  await conn.execute(
    `INSERT INTO match_snapshots (phase, reason, match_count, played_count, rows_json)
     VALUES (?, ?, ?, ?, CAST(? AS JSON))`,
    [phase, reason, rows.length, rows.filter((r) => r.played).length, JSON.stringify(rows)]);
}

export async function latestSnapshot(phase: Phase): Promise<SnapshotSummary | null> {
  const [rows] = await getPool().execute<SnapshotRow[]>(
    `SELECT id, created_at, phase, reason, match_count, played_count
       FROM match_snapshots WHERE phase = ? ORDER BY id DESC LIMIT 1`, [phase]);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    createdAt: row.created_at.getTime(),
    phase: row.phase,
    reason: row.reason,
    matchCount: row.match_count,
    playedCount: row.played_count,
  };
}

/** How many matches in this phase carry a result right now. */
export async function countPlayed(phase: Phase): Promise<number> {
  const [rows] = await getPool().execute<(RowDataPacket & { n: number })[]>(
    'SELECT COUNT(*) AS n FROM matches WHERE phase = ? AND played = 1', [phase]);
  return rows[0]?.n ?? 0;
}

const RESTORED_COLUMNS = [
  'id', 'match_number', 'phase', 'red_alliance_id', 'blue_alliance_id',
  'red1_id', 'red2_id', 'red3_id', 'blue1_id', 'blue2_id', 'blue3_id',
  'played', 'suppression_red', 'suppression_blue', 'extinguisher',
  'climb_red1', 'climb_red2', 'climb_red3',
  'climb_blue1', 'climb_blue2', 'climb_blue3',
  'partner_climb_red', 'partner_climb_blue',
  'minor_fouls_red', 'major_fouls_red', 'minor_fouls_blue', 'major_fouls_blue',
  'card_red1', 'card_red2', 'card_red3',
  'card_blue1', 'card_blue2', 'card_blue3',
] as const;

/**
 * Puts a snapshot back exactly: same match ids, same numbers, same scores.
 *
 * The ids matter. The projector and the alliance table point at matches by id,
 * so a restore that renumbered them would leave a schedule that looks right and
 * links to nothing. Everything runs in one transaction, and the display pointer
 * is cleared first for the same reason the delete paths clear it — the foreign
 * key would otherwise refuse the delete.
 *
 * Returns how many matches were put back.
 */
export async function restoreSnapshot(id: number): Promise<number> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();

    const [snapshots] = await conn.execute<SnapshotRow[]>(
      'SELECT * FROM match_snapshots WHERE id = ?', [id]);
    const snapshot = snapshots[0];
    if (!snapshot) throw new Error('Snapshot not found');

    const rows = parseRows(snapshot.rows_json);

    await conn.execute(
      `UPDATE display_state SET phase = 'standings', match_id = NULL
        WHERE match_id IN (SELECT id FROM matches WHERE phase = ?)`, [snapshot.phase]);
    await conn.execute('DELETE FROM matches WHERE phase = ?', [snapshot.phase]);

    const placeholders = RESTORED_COLUMNS.map(() => '?').join(', ');
    for (const row of rows) {
      await conn.execute<ResultSetHeader>(
        `INSERT INTO matches (${RESTORED_COLUMNS.join(', ')}) VALUES (${placeholders})`,
        RESTORED_COLUMNS.map((c) => row[c as keyof MatchRow] ?? null));
    }

    // Used up: leaving it would offer to restore the same state a second time,
    // over data the operator has entered since.
    await conn.execute('DELETE FROM match_snapshots WHERE id = ?', [id]);

    await conn.commit();
    return rows.length;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
