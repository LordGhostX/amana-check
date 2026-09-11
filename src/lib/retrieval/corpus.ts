import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { corpusRevisions } from "@/lib/db/schema";

export const GLOBAL_CORPUS_SCOPE = "GLOBAL";
export type CorpusRevisionTx = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export function corpusScopeFor(country?: string): string {
  return country?.trim().toUpperCase() || GLOBAL_CORPUS_SCOPE;
}

export async function corpusNewest(country?: string): Promise<Date | null> {
  const rows = await db.execute(
    sql`SELECT max(fetched_at) AS newest FROM documents ${country ? sql`WHERE country = ${country}` : sql``}`,
  );
  const row = (rows as unknown as { newest: string | null }[])[0];
  return row?.newest ? new Date(row.newest) : null;
}

export async function corpusRevision(country?: string): Promise<number> {
  const scope = corpusScopeFor(country);
  const rows = await db
    .select({ revision: corpusRevisions.revision })
    .from(corpusRevisions)
    .where(eq(corpusRevisions.scope, scope))
    .limit(1);
  return rows[0]?.revision ?? 0;
}

export async function advanceCorpusRevision(
  tx: CorpusRevisionTx,
  country?: string,
): Promise<void> {
  const now = new Date();
  const scopes = new Set([corpusScopeFor(country), GLOBAL_CORPUS_SCOPE]);
  for (const scope of scopes) {
    await tx
      .insert(corpusRevisions)
      .values({ scope, revision: 1, updatedAt: now })
      .onConflictDoUpdate({
        target: corpusRevisions.scope,
        set: {
          revision: sql`${corpusRevisions.revision} + 1`,
          updatedAt: now,
        },
      });
  }
}
