import type { RowDataPacket } from 'mysql2';
import { getPool } from './pool';
import type { DisplayPhase, DisplayState } from '../display';

interface DisplayStateRow extends RowDataPacket {
  phase: DisplayPhase;
  match_id: number | null;
}

export async function getDisplayState(): Promise<DisplayState> {
  const [rows] = await getPool().execute<DisplayStateRow[]>(
    'SELECT phase, match_id FROM display_state WHERE id = 1');
  const row = rows[0];
  if (!row) return { phase: 'standings', matchId: null };
  return { phase: row.phase, matchId: row.match_id };
}

export async function setDisplayState(phase: DisplayPhase, matchId: number | null): Promise<void> {
  await getPool().execute(
    'UPDATE display_state SET phase = ?, match_id = ? WHERE id = 1',
    [phase, matchId]);
}
