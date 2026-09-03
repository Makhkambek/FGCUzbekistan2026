import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getPool } from './pool';

export interface Team extends RowDataPacket { id: number; name: string; region: string | null }

export async function listTeams(): Promise<Team[]> {
  const [rows] = await getPool().execute<Team[]>(
    'SELECT id, name, region FROM teams ORDER BY id');
  return rows;
}

export async function createTeam(name: string, region?: string): Promise<void> {
  await getPool().execute(
    'INSERT INTO teams (name, region) VALUES (?, ?)', [name, region ?? null]);
}

export async function updateTeam(id: number, name: string, region?: string): Promise<boolean> {
  const [result] = await getPool().execute<ResultSetHeader>(
    'UPDATE teams SET name = ?, region = ? WHERE id = ?', [name, region ?? null, id]);
  return result.affectedRows > 0;
}

export async function deleteTeam(id: number): Promise<void> {
  await getPool().execute('DELETE FROM teams WHERE id = ?', [id]);
}

export async function deleteAllTeams(): Promise<void> {
  await getPool().execute('DELETE FROM teams');
}
