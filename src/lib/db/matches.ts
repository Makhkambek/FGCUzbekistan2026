import type { RowDataPacket } from 'mysql2';
import { getPool } from './pool';
import type { MatchResultInput } from '../validation';

export interface MatchRow extends RowDataPacket {
  id: number; match_number: number; phase: 'qualification' | 'playoff';
  red_alliance_id: number | null; blue_alliance_id: number | null;
  red1_id: number; red2_id: number; red3_id: number;
  blue1_id: number; blue2_id: number; blue3_id: number;
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

export async function insertMatches(rows: {
  matchNumber: number; phase: 'qualification' | 'playoff';
  red: [number, number, number]; blue: [number, number, number];
  redAllianceId?: number | null; blueAllianceId?: number | null;
}[]): Promise<void> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const r of rows) {
      if (r.red.length !== 3 || r.blue.length !== 3) {
        throw new Error(
          `Матч №${r.matchNumber}: у каждого альянса должно быть ровно три команды`,
        );
      }
      await conn.execute(
        `INSERT INTO matches
           (match_number, phase, red_alliance_id, blue_alliance_id,
            red1_id, red2_id, red3_id, blue1_id, blue2_id, blue3_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.matchNumber, r.phase, r.redAllianceId ?? null, r.blueAllianceId ?? null,
         r.red[0], r.red[1], r.red[2], r.blue[0], r.blue[1], r.blue[2]]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function deleteMatchesByPhase(phase: 'qualification' | 'playoff'): Promise<void> {
  await getPool().execute('DELETE FROM matches WHERE phase = ?', [phase]);
}

/**
 * True if a team id appears in any match — as any of the six per-alliance
 * slots, in either phase. There is no foreign key from matches to teams, so
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

export async function saveMatchResult(id: number, r: MatchResultInput): Promise<void> {
  await getPool().execute(
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
}
