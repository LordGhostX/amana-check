import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export async function corpusNewest(country?: string): Promise<Date | null> {
  const rows = await db.execute(
    sql`SELECT max(fetched_at) AS newest FROM documents ${country ? sql`WHERE country = ${country}` : sql``}`,
  );
  const row = (rows as unknown as { newest: string | null }[])[0];
  return row?.newest ? new Date(row.newest) : null;
}
