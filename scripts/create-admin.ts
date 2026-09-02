import dotenv from 'dotenv';
import path from 'path';
import { getPool } from '../src/lib/db/pool';
import { hashPassword } from '../src/lib/auth/password';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function main() {
  const [username, password] = process.argv.slice(2);
  if (!username || !password) {
    console.error('Использование: npx tsx scripts/create-admin.ts <логин> <пароль>');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('Пароль должен быть не короче 12 символов');
    process.exit(1);
  }
  const hash = await hashPassword(password);
  await getPool().execute(
    'INSERT INTO users (username, password_hash) VALUES (?, ?) ' +
    'ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)',
    [username, hash]);
  console.log(`Пользователь ${username} создан/обновлён`);
  process.exit(0);
}

main();
