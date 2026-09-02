/**
 * Next.js вызывает register() один раз при старте сервера (до приёма запросов).
 * Здесь мы проверяем обязательные переменные окружения, чтобы приложение
 * отказывалось стартовать с неполной конфигурацией, а не падало 500-й
 * при первом обращении (например, при первом входе судьи в систему).
 */
export function register(): void {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error(
      'SESSION_SECRET должен быть задан и быть не короче 32 символов — приложение не может стартовать',
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL должен быть задан — приложение не может стартовать без строки подключения к базе данных',
    );
  }
}
