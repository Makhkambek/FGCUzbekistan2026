/**
 * Next.js calls register() once at server start, before any request is served.
 * Required environment variables are checked here so the app refuses to start
 * on an incomplete configuration instead of failing with a 500 on the first
 * request — for instance on a judge's very first sign-in.
 */
export function register(): void {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error(
      'SESSION_SECRET must be set and at least 32 characters long — the app cannot start',
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL must be set — the app cannot start without a database connection string',
    );
  }
}
