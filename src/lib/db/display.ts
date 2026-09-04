import type { RowDataPacket } from 'mysql2';
import { getPool } from './pool';
import type { DisplayPhase, DisplayState } from '../display';

interface DisplayStateRow extends RowDataPacket {
  phase: DisplayPhase;
  match_id: number | null;
  started_at: Date | null;
  server_now: Date;
}

export async function getDisplayState(): Promise<DisplayState> {
  // NOW(3) comes back from the same query as the state: the countdown on the
  // projector is the difference between these two, and reading the server
  // clock in a second round trip would fold the gap between the two queries
  // into the match time.
  const [rows] = await getPool().execute<DisplayStateRow[]>(
    'SELECT phase, match_id, started_at, NOW(3) AS server_now FROM display_state WHERE id = 1');
  const row = rows[0];
  if (!row) return { phase: 'standings', matchId: null, startedAt: null, serverNow: Date.now() };
  return {
    phase: row.phase,
    matchId: row.match_id,
    startedAt: row.started_at ? row.started_at.getTime() : null,
    serverNow: row.server_now.getTime(),
  };
}

/**
 * Going live starts the 2:30 clock; every other screen clears it, so a result
 * or the standings can never leave a stale countdown behind. Starting the same
 * match twice restarts the clock on purpose — a match replayed after a field
 * fault is started again from the same button.
 */
export async function setDisplayState(phase: DisplayPhase, matchId: number | null): Promise<void> {
  await getPool().execute(
    `UPDATE display_state SET phase = ?, match_id = ?,
       started_at = IF(? = 'live', NOW(3), NULL)
     WHERE id = 1`,
    [phase, matchId, phase]);
}
