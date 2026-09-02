import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    pool = mysql.createPool({ uri: url, connectionLimit: 10, namedPlaceholders: false });
  }
  return pool;
}
