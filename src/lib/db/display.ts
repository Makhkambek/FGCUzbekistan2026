import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getPool } from './pool';
import type { DisplayPhase, DisplayState } from '../display';
import { COUNTDOWN_MS } from '../match-clock';

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
 * Any change of screen clears the clock: putting a match up is only a preview,
 * and a result or the standings must never leave a stale countdown behind.
 * The clock is started separately, by startMatchClock.
 */
export async function setDisplayState(phase: DisplayPhase, matchId: number | null): Promise<void> {
  await getPool().execute(
    'UPDATE display_state SET phase = ?, match_id = ?, started_at = NULL WHERE id = 1',
    [phase, matchId]);
}

/**
 * Starts the match a few seconds from now, so the hall gets 3-2-1 first.
 *
 * Only a match already previewed on the display can be started, and the id
 * must match what is on screen — the referee starting a match while the
 * projector shows a different one would put the hall on the wrong clock. The
 * lead comes from the shared COUNTDOWN_MS so the screens and the database
 * cannot disagree about how long 3-2-1 lasts. Pressing Start twice restarts
 * the countdown on purpose: a match replayed after a field fault is started
 * again from the same button.
 *
 * Returns false when the display is not showing that match live.
 */
export async function startMatchClock(matchId: number): Promise<boolean> {
  const [res] = await getPool().execute<ResultSetHeader>(
    `UPDATE display_state
        SET started_at = NOW(3) + INTERVAL ? MICROSECOND
      WHERE id = 1 AND phase = 'live' AND match_id = ?`,
    [COUNTDOWN_MS * 1000, matchId]);
  return res.affectedRows > 0;
}
