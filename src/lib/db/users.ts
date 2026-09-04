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

/**
 * Creates a referee account, or resets the password of one that exists.
 *
 * The same statement scripts/create-admin.ts runs. It is here as well because
 * that script cannot be run on the server: the production image carries the
 * built Next server and nothing else — no scripts, no tsx — so without this a
 * freshly deployed site has no way to get its first account.
 */
export async function upsertUser(username: string, passwordHash: string): Promise<void> {
  await getPool().execute(
    'INSERT INTO users (username, password_hash) VALUES (?, ?) '
    + 'ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)',
    [username, passwordHash]);
}

export async function countUsers(): Promise<number> {
  const [rows] = await getPool().execute<(RowDataPacket & { n: number })[]>(
    'SELECT COUNT(*) AS n FROM users');
  return rows[0]?.n ?? 0;
}
