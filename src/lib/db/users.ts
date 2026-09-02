import type { RowDataPacket } from 'mysql2';
import { getPool } from './pool';

export interface UserRow extends RowDataPacket {
  id: number; username: string; password_hash: string;
}

export async function findUserByUsername(username: string): Promise<UserRow | null> {
  const [rows] = await getPool().execute<UserRow[]>(
    'SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1', [username]);
  return rows[0] ?? null;
}
