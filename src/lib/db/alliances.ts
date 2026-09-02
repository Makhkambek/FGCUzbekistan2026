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

export async function saveAlliances(state: SelectionState): Promise<void> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM alliances');
    for (const a of state) {
      await conn.execute(
        `INSERT INTO alliances (seed, captain_team_id, pick1_team_id, pick2_team_id)
         VALUES (?, ?, ?, ?)`,
        [a.seed, a.captain, a.picks[0] ?? null, a.picks[1] ?? null]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
