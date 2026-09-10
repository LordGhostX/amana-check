import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Housekeeping for tables that are allowed to grow: completed rate-limit
 * windows. Called from ingestion rather than the request path so user
 * requests never wait on cleanup.
 */
export async function cleanupExpired(): Promise<void> {
  await db.execute(
    sql`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`,
  );
}
