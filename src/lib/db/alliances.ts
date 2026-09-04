import type { RowDataPacket } from 'mysql2';
import { getPool } from './pool';
import type { SelectionState } from '../alliances/selection';

export interface AllianceRow extends RowDataPacket {
  id: number; seed: number;
  captain_team_id: number; pick1_team_id: number | null; pick2_team_id: number | null;
}

export async function getAlliances(): Promise<AllianceRow[]> {
  const [rows] = await getPool().execute<AllianceRow[]>(
    'SELECT id, seed, captain_team_id, pick1_team_id, pick2_team_id FROM alliances ORDER BY seed');
  return rows;
}

/**
 * Read the alliances, derive the next state from them and store it — all in
 * one transaction, with the read locked.
 *
 * `saveAlliances` replaces every row rather than updating one slot, so a
 * read-compute-write done outside a transaction loses picks that another
 * referee committed in between: two picks in *different* alliances still
 * collide, because each request rewrites the whole table from the state it
 * read. `FOR UPDATE` makes the second request wait for the first to commit
 * and then read its result.
 *
 * `mutate` may throw (an invalid pick, too few teams) — the transaction is
 * rolled back and the error propagates untouched.
 */
export async function mutateAlliances(
  mutate: (rows: AllianceRow[]) => SelectionState,
): Promise<SelectionState> {
  const conn = await getPool().getConnection();
  try {
    // Pinned explicitly rather than trusting the server default: under READ
    // COMMITTED a locking read that matches no rows takes no lock at all, so
    // the very first pick of the day — when the table is still empty — would
    // not be serialized against a simultaneous one.
    await conn.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await conn.beginTransaction();
    const [rows] = await conn.execute<AllianceRow[]>(
      `SELECT id, seed, captain_team_id, pick1_team_id, pick2_team_id
       FROM alliances ORDER BY seed FOR UPDATE`);
    const next = mutate(rows);
    await conn.execute('DELETE FROM alliances');
    for (const a of next) {
      await conn.execute(
        // pick2 stays in the table and stays empty: an alliance is a captain
        // and one team, and dropping the column would break a rollback to the
        // previous build during the event.
        `INSERT INTO alliances (seed, captain_team_id, pick1_team_id, pick2_team_id)
         VALUES (?, ?, ?, NULL)`,
        [a.seed, a.captain, a.picks[0] ?? null]);
    }
    await conn.commit();
    return next;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function saveAlliances(state: SelectionState): Promise<void> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM alliances');
    for (const a of state) {
      await conn.execute(
        // pick2 stays in the table and stays empty: an alliance is a captain
        // and one team, and dropping the column would break a rollback to the
        // previous build during the event.
        `INSERT INTO alliances (seed, captain_team_id, pick1_team_id, pick2_team_id)
         VALUES (?, ?, ?, NULL)`,
        [a.seed, a.captain, a.picks[0] ?? null]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
