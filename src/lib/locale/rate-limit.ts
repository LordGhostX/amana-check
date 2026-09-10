import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  ask: { limit: 20, windowMs: 60 * 60 * 1000 },
  feedback: { limit: 20, windowMs: 60 * 60 * 1000 },
  adminLogin: { limit: 10, windowMs: 15 * 60 * 1000 },
} as const;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Fixed-window limiter keyed by HMAC(ip) only. The rate_limits table has no
 * join key to claims and rows are naturally scoped to the window bucket.
 */
export async function checkRateLimit(
  ipHash: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const windowStart = new Date(
    Math.floor(Date.now() / config.windowMs) * config.windowMs,
  );
  const resetAt = new Date(windowStart.getTime() + config.windowMs);

  const rows = await db
    .select({ count: rateLimits.count })
    .from(rateLimits)
    .where(
      and(
        eq(rateLimits.ipHash, ipHash),
        eq(rateLimits.windowStart, windowStart),
      ),
    )
    .limit(1);

  const current = rows[0]?.count ?? 0;
  if (current >= config.limit) {
    return { allowed: false, remaining: 0, resetAt };
  }

  if (!rows[0]) {
    await db
      .insert(rateLimits)
      .values({ ipHash, windowStart, count: 1 })
      .onConflictDoUpdate({
        target: [rateLimits.ipHash, rateLimits.windowStart],
        set: { count: sql`${rateLimits.count} + 1` },
      });
  } else {
    await db
      .update(rateLimits)
      .set({ count: current + 1 })
      .where(
        and(
          eq(rateLimits.ipHash, ipHash),
          eq(rateLimits.windowStart, windowStart),
        ),
      );
  }

  return {
    allowed: true,
    remaining: Math.max(0, config.limit - current - 1),
    resetAt,
  };
}
