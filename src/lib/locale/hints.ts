import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { localeHints } from "@/lib/db/schema";

export const LOCALE_HINT_TTL_DAYS = 30;
export const LOCALE_HINT_MIN_CONFIDENCE = 60;

export async function readLocaleHint(ipHash: string): Promise<string | null> {
  const rows = await db
    .select({ locale: localeHints.locale, expiresAt: localeHints.expiresAt })
    .from(localeHints)
    .where(eq(localeHints.ipHash, ipHash))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(localeHints).where(eq(localeHints.ipHash, ipHash));
    return null;
  }
  return row.locale;
}

/**
 * Only called when language detection crossed the confidence threshold.
 * The cookie is the primary memory; this is an isolated fallback keyed by
 * HMAC(ip) and never joined to claims.
 */
export async function writeLocaleHint(
  ipHash: string,
  locale: string,
  confidence: number,
): Promise<void> {
  if (confidence < LOCALE_HINT_MIN_CONFIDENCE) return;
  const expiresAt = new Date(
    Date.now() + LOCALE_HINT_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  await db
    .insert(localeHints)
    .values({ ipHash, locale, confidence, expiresAt })
    .onConflictDoUpdate({
      target: localeHints.ipHash,
      set: {
        locale,
        confidence,
        hits: sql`${localeHints.hits} + 1`,
        lastSeen: new Date(),
        expiresAt,
      },
    });
}
