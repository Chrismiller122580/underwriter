import { ensureSchema, getSql } from '@/lib/db';

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

const DEFAULT_LIMIT = 10;
const DEFAULT_WINDOW_MS = 60 * 60 * 1000;

export async function checkRateLimit(
  key: string,
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS
): Promise<RateLimitResult> {
  await ensureSchema();
  const sql = getSql();
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);

  const existing = (await sql`
    SELECT hits, reset_at FROM rate_limits WHERE id = ${key}
  `) as { hits: number; reset_at: string }[];

  if (existing.length === 0) {
    await sql`
      INSERT INTO rate_limits (id, hits, reset_at)
      VALUES (${key}, 1, ${resetAt.toISOString()})
      ON CONFLICT (id) DO UPDATE SET hits = 1, reset_at = ${resetAt.toISOString()}
    `;
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  const row = existing[0];
  const rowReset = new Date(row.reset_at);

  if (rowReset <= now) {
    await sql`
      UPDATE rate_limits SET hits = 1, reset_at = ${resetAt.toISOString()}
      WHERE id = ${key}
    `;
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (row.hits >= limit) {
    return { allowed: false, remaining: 0, resetAt: rowReset };
  }

  await sql`
    UPDATE rate_limits SET hits = hits + 1 WHERE id = ${key}
  `;

  return {
    allowed: true,
    remaining: limit - row.hits - 1,
    resetAt: rowReset,
  };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}