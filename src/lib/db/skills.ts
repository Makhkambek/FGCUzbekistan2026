import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getPool } from './pool';
import {
  skillsAttemptOrder, skillsAttemptScore, skillsAttemptsByTeam, skillsStandings,
  skillsTeamIds,
} from '../skills/scoring';
import type { SkillsStanding, TeamAttempt } from '../skills/scoring';
import type { CardType, ClimbPosition } from '../scoring/types';

export type AllianceColour = 'red' | 'blue';

export interface SkillsAttemptRow extends RowDataPacket {
  id: number;
  round: number;
  position: number;
  team_id: number;
  alliance: AllianceColour;
  played: number;
  suppression: number;
  human_balls: number;
  climb: ClimbPosition;
  extinguisher: number;
  minor_fouls: number;
  major_fouls: number;
  card: CardType;
}

export function attemptScore(row: SkillsAttemptRow): number {
  return skillsAttemptScore({
    suppression: row.suppression,
    humanBalls: row.human_balls,
    climb: row.climb,
    extinguisher: row.extinguisher,
    minorFouls: row.minor_fouls,
    majorFouls: row.major_fouls,
    card: row.card,
  });
}

export async function listAttempts(): Promise<SkillsAttemptRow[]> {
  const [rows] = await getPool().execute<SkillsAttemptRow[]>(
    'SELECT * FROM skills_attempts ORDER BY round, position');
  return rows;
}

export async function getAttempt(id: number): Promise<SkillsAttemptRow | null> {
  const [rows] = await getPool().execute<SkillsAttemptRow[]>(
    'SELECT * FROM skills_attempts WHERE id = ?', [id]);
  return rows[0] ?? null;
}

/**
 * Replaces the whole skills running order.
 *
 * Refused once any attempt has been scored — same rule as the qualification
 * schedule, and for the same reason: rebuilding would throw away results with
 * no way back. Everything runs in one transaction so a failure cannot leave
 * the phase half-built, and the display pointer is cleared first because the
 * foreign key would otherwise refuse the delete.
 */
export async function replaceAttempts(
  teamIds: number[], attemptsPerTeam: number, alliance: AllianceColour,
): Promise<number> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();

    // FOR UPDATE, not a plain read: this transaction is about to delete every
    // row, so it must see the latest committed data rather than the snapshot
    // it opened with, and a referee saving a score at the same moment must
    // queue behind it instead of slipping in between the check and the
    // delete.
    const [played] = await conn.execute<(RowDataPacket & { n: number })[]>(
      'SELECT COUNT(*) AS n FROM skills_attempts WHERE played = 1 FOR UPDATE');
    if ((played[0]?.n ?? 0) > 0) {
      await conn.rollback();
      throw new Error('Some skills attempts have already been scored — the running order cannot be rebuilt');
    }

    await conn.execute(
      `UPDATE display_state SET phase = 'standings', match_id = NULL, skills_attempt_id = NULL
        WHERE skills_attempt_id IS NOT NULL`);

    // Only the unscored rows go, and then the table has to be empty. The
    // count above is a snapshot read: a referee saving a score in the very
    // same second commits after it and would be wiped by an unqualified
    // DELETE, with this rebuild still reporting success. Deleting what is
    // safe to delete and refusing when anything survives makes the referee's
    // save win the race, whichever order the two land in.
    await conn.execute('DELETE FROM skills_attempts WHERE played = 0');
    const [survivors] = await conn.execute<(RowDataPacket & { n: number })[]>(
      'SELECT COUNT(*) AS n FROM skills_attempts FOR UPDATE');
    if ((survivors[0]?.n ?? 0) > 0) {
      await conn.rollback();
      throw new Error('Some skills attempts have already been scored — the running order cannot be rebuilt');
    }

    const slots = skillsAttemptOrder(teamIds, attemptsPerTeam);
    let position = 0;
    let round = 0;
    for (const slot of slots) {
      if (slot.round !== round) { round = slot.round; position = 0; }
      await conn.execute(
        `INSERT INTO skills_attempts (round, position, team_id, alliance)
         VALUES (?, ?, ?, ?)`,
        [slot.round, position++, slot.teamId, alliance]);
    }

    await conn.commit();
    return slots.length;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export interface SkillsResultInput {
  suppression: number;
  humanBalls: number;
  climb: ClimbPosition;
  extinguisher: number;
  minorFouls: number;
  majorFouls: number;
  card: CardType;
}

export async function saveAttemptResult(id: number, r: SkillsResultInput): Promise<boolean> {
  const [res] = await getPool().execute<ResultSetHeader>(
    `UPDATE skills_attempts SET played = TRUE,
       suppression = ?, human_balls = ?, climb = ?, extinguisher = ?,
       minor_fouls = ?, major_fouls = ?, card = ?
     WHERE id = ?`,
    [r.suppression, r.humanBalls, r.climb, r.extinguisher,
      r.minorFouls, r.majorFouls, r.card, id]);
  return res.affectedRows > 0;
}

export async function setAttemptAlliance(id: number, alliance: AllianceColour): Promise<boolean> {
  const [res] = await getPool().execute<ResultSetHeader>(
    'UPDATE skills_attempts SET alliance = ? WHERE id = ?', [alliance, id]);
  return res.affectedRows > 0;
}

/** Clears one attempt's result back to unplayed, leaving its place in the order. */
export async function resetAttemptResult(id: number): Promise<boolean> {
  const [res] = await getPool().execute<ResultSetHeader>(
    `UPDATE skills_attempts SET played = FALSE,
       suppression = 0, human_balls = 0, climb = 'none', extinguisher = 0,
       minor_fouls = 0, major_fouls = 0, card = 'none'
     WHERE id = ?`, [id]);
  return res.affectedRows > 0;
}

export async function skillsTable(teamIds: number[]): Promise<SkillsStanding[]> {
  const rows = await listAttempts();
  return skillsStandings(teamIds, scored(rows));
}

/**
 * The skills table plus each team's own attempts, for the public board.
 *
 * The teams are whoever is in the running order — not every team at the
 * event, and not only the ones who have already run.
 */
export async function skillsBoard(): Promise<{
  standings: SkillsStanding[];
  attempts: Record<number, TeamAttempt[]>;
}> {
  const rows = await listAttempts();
  const s = scored(rows);
  const teamIds = skillsTeamIds(s);
  return {
    standings: skillsStandings(teamIds, s),
    attempts: skillsAttemptsByTeam(teamIds, s),
  };
}

function scored(rows: SkillsAttemptRow[]) {
  return rows.map((r) => ({
    teamId: r.team_id,
    round: r.round,
    score: attemptScore(r),
    played: !!r.played,
  }));
}
