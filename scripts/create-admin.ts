import dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';
import { getPool } from '../src/lib/db/pool';
import { hashPassword } from '../src/lib/auth/password';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function readPasswordFromStdin(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
      terminal: process.stdin.isTTY,
    });

    process.stderr.write('Пароль: ');

    if (process.stdin.isTTY) {
      // Interactive mode: suppress echo
      process.stdin.setRawMode(true);
      let password = '';
      process.stdin.on('data', (char) => {
        const code = char[0];
        if (code === 13 || code === 10) {
          // Enter key
          process.stdin.setRawMode(false);
          process.stderr.write('\n');
          rl.close();
          resolve(password);
        } else if (code === 3) {
          // Ctrl+C
          process.stdin.setRawMode(false);
          rl.close();
          process.exit(1);
        } else if (code === 127 || code === 8) {
          // Backspace
          password = password.slice(0, -1);
        } else if (code >= 32) {
          // Printable character
          password += String.fromCharCode(code);
        }
      });
    } else {
      // Pipe mode: just read line normally
      rl.question('', (password) => {
        rl.close();
        resolve(password);
      });
    }
  });
}

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error('Использование: npx tsx scripts/create-admin.ts <логин>');
    process.exit(1);
  }

  const password = await readPasswordFromStdin();

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

main().catch((err) => {
  console.error('Ошибка:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
