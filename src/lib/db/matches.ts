import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import { getPool } from './pool';
import { takeSnapshot } from './snapshots';
import type { MatchResultInput } from '../validation';

export interface MatchRow extends RowDataPacket {
  id: number; match_number: number; phase: 'qualification' | 'playoff';
  red_alliance_id: number | null; blue_alliance_id: number | null;
  red1_id: number; red2_id: number;
  /**
   * Always empty from 5 September 2026: an alliance is two robots in every
   * phase. Rows generated before that date still carry a third team, so every
   * screen reads the slot and drops it when it is empty rather than drawing a
   * dash where no team stands.
   */
  red3_id: number | null;
  blue1_id: number; blue2_id: number; blue3_id: number | null;
  played: number;
  suppression_red: number; suppression_blue: number; extinguisher: number;
  climb_red1: string; climb_red2: string; climb_red3: string;
  climb_blue1: string; climb_blue2: string; climb_blue3: string;
  partner_climb_red: number; partner_climb_blue: number;
  minor_fouls_red: number; major_fouls_red: number;
  minor_fouls_blue: number; major_fouls_blue: number;
  card_red1: string; card_red2: string; card_red3: string;
  card_blue1: string; card_blue2: string; card_blue3: string;
}

export async function listMatches(phase?: 'qualification' | 'playoff'): Promise<MatchRow[]> {
  const pool = getPool();
  if (phase) {
    const [rows] = await pool.execute<MatchRow[]>(
      'SELECT * FROM matches WHERE phase = ? ORDER BY match_number', [phase]);
    return rows;
  }
  const [rows] = await pool.execute<MatchRow[]>(
    'SELECT * FROM matches ORDER BY phase, match_number');
  return rows;
}

/**
 * Points the projector display back at the standings if it is currently
 * showing a match in `phase`, using the caller's connection so it lands in
 * the same transaction as the delete that follows.
 *
 * display_state.match_id references matches(id) with MySQL's default
 * RESTRICT, so deleting a phase while the display still points into it fails
 * outright with a foreign key error — the reset or regeneration then surfaces
 * as a 500 and silently does nothing. Pressing "Start match" and later
 * rebuilding the schedule is an ordinary sequence for a judge, so both paths
 * clear the pointer first. Standings is the right landing spot: it is also
 * where buildDisplayPayload falls back when a matchId no longer resolves.
 */
async function clearDisplayPointerForPhase(
  conn: PoolConnection, phase: 'qualification' | 'playoff',
): Promise<void> {
  await conn.execute(
    `UPDATE display_state SET phase = 'standings', match_id = NULL
      WHERE match_id IN (SELECT id FROM matches WHERE phase = ?)`, [phase]);
}

/**
 * Makes sure a match may leave its third slot empty.
 *
 * This is the migration 2026-09-04-two-robot-alliances.sql, applied by the
 * site itself. Schema changes here are normally run by hand, and that is
 * still the better way — but the server's database is reachable only from the
 * server, the production image carries no scripts, and a schedule or bracket
 * that cannot be built because a column is NOT NULL would take the event down
 * with it. Both paths call it now that qualification is two robots a side too.
 *
 * It reads the column first and does nothing when it is already nullable, so
 * it costs one cheap query per generation and is safe to call again.
 */
export async function ensureThirdRobotSlotsNullable(): Promise<boolean> {
  const pool = getPool();
  const [rows] = await pool.execute<(RowDataPacket & { IS_NULLABLE: string })[]>(
    `SELECT IS_NULLABLE FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'red3_id'`);
  if (rows[0]?.IS_NULLABLE === 'YES') return false;

  await pool.query('ALTER TABLE matches MODIFY red3_id INT NULL, MODIFY blue3_id INT NULL');
  console.warn('matches.red3_id/blue3_id made nullable — two-robot alliances');
  return true;
}

export async function insertMatches(rows: {
  matchNumber: number; phase: 'qualification' | 'playoff';
  /**
   * Two team ids, and optionally a third for a row generated under the old
   * three-a-side qualification rules. A missing third is stored as NULL.
   */
  red: (number | null)[]; blue: (number | null)[];
  redAllianceId?: number | null; blueAllianceId?: number | null;
}[], options?: { clearPhase?: 'qualification' | 'playoff' }): Promise<void> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Clearing the phase inside this same transaction (rather than as a
    // separate call before insertMatches) makes replacement atomic: if the
    // insert below fails, the rollback restores the matches that were about
    // to be replaced instead of leaving the phase empty.
    if (options?.clearPhase) {
      await takeSnapshot(conn, options.clearPhase, 'regenerate');
      await clearDisplayPointerForPhase(conn, options.clearPhase);
      await conn.execute('DELETE FROM matches WHERE phase = ?', [options.clearPhase]);
    }
    for (const r of rows) {
      const sides = [r.red, r.blue];
      if (sides.some((s) => s.length < 2 || s.length > 3 || s[0] === null || s[1] === null)) {
        throw new Error(
          `Match ${r.matchNumber}: each alliance needs two teams, and may name a third`,
        );
      }
      const red = [r.red[0], r.red[1], r.red[2] ?? null];
      const blue = [r.blue[0], r.blue[1], r.blue[2] ?? null];
      await conn.execute(
        `INSERT INTO matches
           (match_number, phase, red_alliance_id, blue_alliance_id,
            red1_id, red2_id, red3_id, blue1_id, blue2_id, blue3_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.matchNumber, r.phase, r.redAllianceId ?? null, r.blueAllianceId ?? null,
         ...red, ...blue]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/** Returns how many matches were removed, so the UI can say what happened. */
export async function deleteMatchesByPhase(phase: 'qualification' | 'playoff'): Promise<number> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    // Copy first, inside the same transaction: a reset is the one action here
    // that throws away a day of scoring, and until now it was final.
    await takeSnapshot(conn, phase, 'reset');
    await clearDisplayPointerForPhase(conn, phase);
    const [result] = await conn.execute<ResultSetHeader>(
      'DELETE FROM matches WHERE phase = ?', [phase]);
    await conn.commit();
    return result.affectedRows;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function getMatchById(id: number): Promise<MatchRow | null> {
  const [rows] = await getPool().execute<MatchRow[]>(
    'SELECT * FROM matches WHERE id = ?', [id]);
  return rows[0] ?? null;
}

/**
 * True if a team id appears in any match — in any of the per-alliance slots,
 * in either phase. There is no foreign key from matches to teams, so
 * callers must check this themselves before deleting a team; otherwise the
 * match rows are orphaned and the scoreboard renders a bare numeric id.
 */
export async function teamAppearsInMatches(teamId: number): Promise<boolean> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT 1 FROM matches
     WHERE red1_id = ? OR red2_id = ? OR red3_id = ?
        OR blue1_id = ? OR blue2_id = ? OR blue3_id = ?
     LIMIT 1`,
    [teamId, teamId, teamId, teamId, teamId, teamId]);
  return rows.length > 0;
}

/**
 * Returns true if a match row with this id was actually updated. The
 * schedule can be regenerated while a judge has this match's entry page
 * open — a stale id must be reported to the caller rather than silently
 * reporting success. `affectedRows` reflects rows *matched* by the WHERE
 * clause on this pool's connections (verified: a same-value re-save of an
 * existing row still reports 1, and only a missing id reports 0), so this
 * check does not misfire on an unchanged re-save.
 */
export async function saveMatchResult(id: number, r: MatchResultInput): Promise<boolean> {
  const [result] = await getPool().execute<ResultSetHeader>(
    `UPDATE matches SET played = TRUE,
       suppression_red = ?, suppression_blue = ?, extinguisher = ?,
       climb_red1 = ?, climb_red2 = ?, climb_red3 = ?,
       climb_blue1 = ?, climb_blue2 = ?, climb_blue3 = ?,
       partner_climb_red = ?, partner_climb_blue = ?,
       minor_fouls_red = ?, major_fouls_red = ?,
       minor_fouls_blue = ?, major_fouls_blue = ?,
       card_red1 = ?, card_red2 = ?, card_red3 = ?,
       card_blue1 = ?, card_blue2 = ?, card_blue3 = ?
     WHERE id = ?`,
    [r.suppressionRed, r.suppressionBlue, r.extinguisher,
     ...r.climbRed, ...r.climbBlue,
     r.partnerClimbRed, r.partnerClimbBlue,
     r.minorFoulsRed, r.majorFoulsRed, r.minorFoulsBlue, r.majorFoulsBlue,
     ...r.cardRed, ...r.cardBlue, id]);
  return result.affectedRows > 0;
}

/**
 * Clears a single match's entered result back to the unplayed defaults
 * (same values db/schema.sql assigns a freshly generated match) without
 * touching its match_number, phase, or team assignments — a judge can
 * re-enter the result afterwards without regenerating the schedule.
 *
 * The whole phase is snapshotted first. The cleared row is the point, but
 * restoring the phase as a unit is what makes the rollback exact rather than
 * approximate.
 */
export async function resetMatchResult(id: number): Promise<boolean> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const [target] = await conn.execute<MatchRow[]>(
      'SELECT phase FROM matches WHERE id = ?', [id]);
    if (!target[0]) { await conn.rollback(); return false; }
    await takeSnapshot(conn, target[0].phase, 'match-reset');
    const [result] = await conn.execute<ResultSetHeader>(
      `UPDATE matches SET played = FALSE,
       suppression_red = 0, suppression_blue = 0, extinguisher = 0,
       climb_red1 = 'none', climb_red2 = 'none', climb_red3 = 'none',
       climb_blue1 = 'none', climb_blue2 = 'none', climb_blue3 = 'none',
       partner_climb_red = 0, partner_climb_blue = 0,
       minor_fouls_red = 0, major_fouls_red = 0,
       minor_fouls_blue = 0, major_fouls_blue = 0,
       card_red1 = 'none', card_red2 = 'none', card_red3 = 'none',
       card_blue1 = 'none', card_blue2 = 'none', card_blue3 = 'none'
     WHERE id = ?`,
      [id]);
    await conn.commit();
    return result.affectedRows > 0;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
