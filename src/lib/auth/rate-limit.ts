const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 30 * 60 * 1000;

const attempts = new Map<string, { count: number; firstAt: number; blockedUntil: number }>();

export function checkRateLimit(key: string, now: number = Date.now()) {
  const rec = attempts.get(key);
  if (!rec) return { allowed: true, retryAfterMs: 0 };
  if (now < rec.blockedUntil) {
    return { allowed: false, retryAfterMs: rec.blockedUntil - now };
  }
  if (now - rec.firstAt > WINDOW_MS) {
    attempts.delete(key);
    return { allowed: true, retryAfterMs: 0 };
  }
  return { allowed: rec.count < MAX_ATTEMPTS, retryAfterMs: 0 };
}

export function recordFailure(key: string, now: number = Date.now()): void {
  const rec = attempts.get(key);
  if (!rec || now - rec.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now, blockedUntil: 0 });
    return;
  }
  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS) rec.blockedUntil = now + BLOCK_MS;
}

export function resetRateLimit(key: string): void {
  attempts.delete(key);
}
