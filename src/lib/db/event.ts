import type { ResultSetHeader } from 'mysql2/promise';
import { getPool } from './pool';
import { takeSnapshot } from './snapshots';
import type { ClearedCounts } from '../event/clear';

/**
 * Wipes everything the event produced — matches with their results, the
 * bracket, the alliances, the skills attempts — and leaves the teams.
 *
 * One transaction, in the order the foreign keys demand: display_state points
 * at matches and skills attempts, so the projector goes back to the standings
 * first; alliances reference teams only, so they can go at any point.
 * Snapshots of both phases are taken inside the same transaction, the same
 * way a schedule reset does it, so the day's scoring can still be restored
 * from the schedule page if this was the wrong button.
 */
export async function clearEvent(): Promise<ClearedCounts> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    await takeSnapshot(conn, 'qualification', 'reset');
    await takeSnapshot(conn, 'playoff', 'reset');

    await conn.execute(
      `UPDATE display_state
          SET phase = 'standings', match_id = NULL, skills_attempt_id = NULL, started_at = NULL
        WHERE id = 1`);

    const [qual] = await conn.execute<ResultSetHeader>(
      "DELETE FROM matches WHERE phase = 'qualification'");
    const [playoff] = await conn.execute<ResultSetHeader>(
      "DELETE FROM matches WHERE phase = 'playoff'");
    const [alliances] = await conn.execute<ResultSetHeader>('DELETE FROM alliances');
    const [skills] = await conn.execute<ResultSetHeader>('DELETE FROM skills_attempts');

    await conn.commit();
    return {
      qualification: qual.affectedRows,
      playoff: playoff.affectedRows,
      alliances: alliances.affectedRows,
      skillsAttempts: skills.affectedRows,
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
