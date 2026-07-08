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

  const incremented = (await sql`
    UPDATE rate_limits
    SET hits = hits + 1
    WHERE id = ${key}
      AND reset_at > ${now.toISOString()}
      AND hits < ${limit}
    RETURNING hits, reset_at
  `) as { hits: number; reset_at: string }[];

  if (incremented.length > 0) {
    const row = incremented[0];
    return {
      allowed: true,
      remaining: Math.max(0, limit - row.hits),
      resetAt: new Date(row.reset_at),
    };
  }

  const blocked = (await sql`
    SELECT hits, reset_at
    FROM rate_limits
    WHERE id = ${key}
      AND reset_at > ${now.toISOString()}
      AND hits >= ${limit}
  `) as { hits: number; reset_at: string }[];

  if (blocked.length > 0) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(blocked[0].reset_at),
    };
  }

  const upserted = (await sql`
    INSERT INTO rate_limits (id, hits, reset_at)
    VALUES (${key}, 1, ${resetAt.toISOString()})
    ON CONFLICT (id) DO UPDATE
    SET hits = 1, reset_at = ${resetAt.toISOString()}
    WHERE rate_limits.reset_at <= ${now.toISOString()}
    RETURNING hits, reset_at
  `) as { hits: number; reset_at: string }[];

  if (upserted.length > 0) {
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: new Date(upserted[0].reset_at),
    };
  }

  const retried = (await sql`
    UPDATE rate_limits
    SET hits = hits + 1
    WHERE id = ${key}
      AND reset_at > ${now.toISOString()}
      AND hits < ${limit}
    RETURNING hits, reset_at
  `) as { hits: number; reset_at: string }[];

  if (retried.length > 0) {
    const row = retried[0];
    return {
      allowed: true,
      remaining: Math.max(0, limit - row.hits),
      resetAt: new Date(row.reset_at),
    };
  }

  const stillBlocked = (await sql`
    SELECT reset_at
    FROM rate_limits
    WHERE id = ${key}
      AND reset_at > ${now.toISOString()}
      AND hits >= ${limit}
  `) as { reset_at: string }[];

  if (stillBlocked.length > 0) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(stillBlocked[0].reset_at),
    };
  }

  return { allowed: true, remaining: limit - 1, resetAt };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}