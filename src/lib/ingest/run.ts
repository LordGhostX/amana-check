import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  documentChunks,
  documentVersions,
  documents,
  ingestionRuns,
  sources,
} from "@/lib/db/schema";
import { chunkText } from "./chunk";
import { htmlToText } from "./clean";
import { fetchFeed, type FeedItem } from "./rss";
import { cleanupExpired } from "@/lib/maintenance";

export interface IngestOptions {
  sourceId?: string;
  country?: string;
  limitPerSource?: number;
}

export interface IngestSummary {
  sourcesProcessed: number;
  sourcesFailed: number;
  added: number;
  updated: number;
  unchanged: number;
  skipped: number;
  errors: string[];
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type SourceRow = typeof sources.$inferSelect;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function documentIdFor(sourceId: string, url: string): string {
  return `${sourceId}-${sha256(url).slice(0, 24)}`;
}

async function insertChunks(tx: Tx, documentId: string, text: string) {
  const chunks = chunkText(text);
  if (chunks.length === 0) return;
  await tx.insert(documentChunks).values(
    chunks.map((chunk) => ({
      documentId,
      ordinal: chunk.ordinal,
      content: chunk.content,
      page: chunk.page,
      anchor: chunk.anchor,
    })),
  );
}

async function upsertDocument(
  source: SourceRow,
  item: FeedItem,
  text: string,
): Promise<"added" | "updated" | "unchanged"> {
  const id = documentIdFor(source.id, item.link);
  const contentHash = sha256(text);
  const now = new Date();
  const title =
    item.title === "(untitled)" ? text.slice(0, 80).trim() : item.title;

  return db.transaction(async (tx) => {
    const existingRows = await tx
      .select({
        id: documents.id,
        contentHash: documents.contentHash,
        version: documents.version,
        title: documents.title,
        url: documents.url,
        publishedAt: documents.publishedAt,
        fetchedAt: documents.fetchedAt,
        sourceId: documents.sourceId,
      })
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    const existing = existingRows[0];

    if (!existing) {
      await tx.insert(documents).values({
        id,
        sourceId: source.id,
        title,
        url: item.link,
        content: text,
        language: "en",
        publishedAt: item.publishedAt,
        fetchedAt: now,
        country: source.country,
        scopes: source.scope,
        tier: source.tier,
        license: source.license,
        contentHash,
        version: 1,
      });
      await insertChunks(tx, id, text);
      return "added" as const;
    }

    if (existing.contentHash === contentHash) {
      await tx
        .update(documents)
        .set({ fetchedAt: now, title })
        .where(eq(documents.id, id));
      return "unchanged" as const;
    }

    await tx.insert(documentVersions).values({
      documentId: id,
      version: existing.version,
      contentHash: existing.contentHash,
      snapshot: {
        title: existing.title,
        url: existing.url,
        contentHash: existing.contentHash,
        publishedAt: existing.publishedAt?.toISOString() ?? null,
        fetchedAt: existing.fetchedAt.toISOString(),
        sourceId: existing.sourceId,
      },
    });
    await tx.delete(documentChunks).where(eq(documentChunks.documentId, id));
    await tx
      .update(documents)
      .set({
        title,
        url: item.link,
        content: text,
        publishedAt: item.publishedAt,
        fetchedAt: now,
        contentHash,
        version: existing.version + 1,
      })
      .where(eq(documents.id, id));
    await insertChunks(tx, id, text);
    return "updated" as const;
  });
}

export async function ingestSources(
  options: IngestOptions = {},
): Promise<IngestSummary> {
  try {
    await cleanupExpired();
  } catch {
    // Cleanup must never block ingestion.
  }

  const summary: IngestSummary = {
    sourcesProcessed: 0,
    sourcesFailed: 0,
    added: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    errors: [],
  };

  const enabledSources = await db
    .select()
    .from(sources)
    .where(eq(sources.enabled, true));

  const selected = enabledSources.filter(
    (source) =>
      (!options.sourceId || source.id === options.sourceId) &&
      (!options.country || source.country === options.country),
  );

  for (const source of selected) {
    summary.sourcesProcessed += 1;
    const startedAt = new Date();
    const errors: string[] = [];
    let added = 0;
    let updated = 0;
    let unchanged = 0;

    try {
      if (source.fetchKind !== "rss") {
        throw new Error(`Unsupported fetch kind: ${source.fetchKind}`);
      }
      const rawItems = await fetchFeed(source.url);
      if (rawItems.length === 0) {
        throw new Error(
          "feed returned no items — likely not RSS (check the URL)",
        );
      }

      const cleaned = rawItems.map((item) => ({
        item,
        text: htmlToText(item.html),
      }));
      const keywords = source.includeKeywords.map((keyword) =>
        keyword.toLowerCase(),
      );
      const relevant =
        keywords.length === 0
          ? cleaned
          : cleaned.filter(({ item, text }) => {
              const haystack = `${item.title}\n${text}`.toLowerCase();
              return keywords.some((keyword) => haystack.includes(keyword));
            });
      const limited = options.limitPerSource
        ? relevant.slice(0, options.limitPerSource)
        : relevant;

      for (const { item, text } of limited) {
        try {
          if (text.length < 120) {
            summary.skipped += 1;
            continue;
          }
          const result = await upsertDocument(source, item, text);
          if (result === "added") added += 1;
          else if (result === "updated") updated += 1;
          else unchanged += 1;
        } catch (error) {
          errors.push(`${item.link}: ${String(error)}`);
        }
      }

      const productive = added + updated > 0;
      await db
        .update(sources)
        .set({
          lastFetchAt: startedAt,
          lastSuccessAt: new Date(),
          consecutiveFailures: 0,
          zeroYieldStreak: productive ? 0 : sql`${sources.zeroYieldStreak} + 1`,
        })
        .where(eq(sources.id, source.id));
      await db.insert(ingestionRuns).values({
        sourceId: source.id,
        status: errors.length > 0 ? "partial" : "success",
        documentsAdded: added,
        documentsUpdated: updated,
        errors,
        startedAt,
        finishedAt: new Date(),
      });
    } catch (error) {
      const message = String(error);
      errors.push(message);
      summary.errors.push(`${source.id}: ${message}`);
      summary.sourcesFailed += 1;
      await db
        .update(sources)
        .set({
          lastFetchAt: startedAt,
          consecutiveFailures: sql`${sources.consecutiveFailures} + 1`,
        })
        .where(eq(sources.id, source.id));
      await db.insert(ingestionRuns).values({
        sourceId: source.id,
        status: "error",
        errors,
        startedAt,
        finishedAt: new Date(),
      });
    }

    summary.added += added;
    summary.updated += updated;
    summary.unchanged += unchanged;
    console.log(
      `${source.id}: +${added} new, ${updated} updated, ${unchanged} unchanged${errors.length ? `, ${errors.length} item errors` : ""}`,
    );
  }

  return summary;
}
