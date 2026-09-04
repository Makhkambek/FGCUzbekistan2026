/**
 * Rate-limit keys for the login endpoint.
 *
 * The limiter counts failed attempts per account, but "the same account" is
 * decided by MySQL, not by JavaScript. `users.username` is compared under
 * utf8mb4_unicode_ci, which folds case AND accents: `ádmin` matches the row
 * stored as `admin`. Keying the limiter on a plain `toLowerCase()` therefore
 * handed every diacritic spelling its own five-attempt budget while the
 * database kept resolving them all to one real account — the lockout never
 * fired and the password could be guessed indefinitely.
 */

/**
 * The best a string-only key can do: fold case, decompose to base letters and
 * drop the combining marks, and normalise compatibility forms (full-width
 * latin, ligatures). This still does not cover every equivalence the collation
 * has (`ß` = `ss`), which is why a resolved account is keyed by id instead —
 * this is only the fallback for names that match no row at all.
 */
export function normalizeLoginKey(username: string): string {
  return username
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Once the row is known, its id is exactly what the database matched on, so
 * no amount of creative spelling can split one account across two counters.
 * The prefix keeps the id namespace from ever colliding with a username key.
 */
export function rateLimitKeyForUserId(userId: number): string {
  return `id:${userId}`;
}
