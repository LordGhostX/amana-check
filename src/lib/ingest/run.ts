import { createHash, randomInt } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  documentChunks,
  documentVersions,
  documents,
  ingestionRuns,
  sources,
} from "@/lib/db/schema";
import { cleanupExpired } from "@/lib/maintenance";
import { chunkText } from "./chunk";
import { htmlToText } from "./clean";
import { fetchHtmlItems, type HtmlItem } from "./html";
import { withIngestLock } from "./lock";
import { fetchFeed, type FeedItem } from "./rss";

export interface IngestOptions {
  sourceId?: string;
  country?: string;
  limitPerSource?: number;
  sourceConcurrency?: number;
}

export interface IngestSummary {
  status: "completed" | "skipped";
  durationMs: number;
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
type IngestCounts = Omit<IngestSummary, "status" | "durationMs">;
type FeedCache = Map<string, Promise<FeedItem[]>>;

interface NormalizedItem {
  title: string;
  link: string;
  publishedAt: Date | null;
  text: string;
}

interface SourceResult extends IngestCounts {
  sourceId: string;
}

interface SourceCounts {
  added: number;
  updated: number;
  unchanged: number;
  skipped: number;
  errors: string[];
}

const DEFAULT_SOURCE_CONCURRENCY = 4;
const MAX_SOURCE_CONCURRENCY = 4;
const MIN_DOCUMENT_TEXT_LENGTH = 120;

function emptySummary(
  status: IngestSummary["status"],
  durationMs: number,
): IngestSummary {
  return {
    status,
    durationMs,
    sourcesProcessed: 0,
    sourcesFailed: 0,
    added: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    errors: [],
  };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sourceConcurrency(options: IngestOptions): number {
  const raw = options.sourceConcurrency ?? DEFAULT_SOURCE_CONCURRENCY;
  if (!Number.isFinite(raw)) return DEFAULT_SOURCE_CONCURRENCY;
  return Math.min(MAX_SOURCE_CONCURRENCY, Math.max(1, Math.floor(raw)));
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

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
    })),
  );
}

async function upsertDocument(
  source: SourceRow,
  item: NormalizedItem,
): Promise<"added" | "updated" | "unchanged"> {
  const id = documentIdFor(source.id, item.link);
  const contentHash = sha256(item.text);
  const now = new Date();
  const title =
    item.title === "(untitled)" ? item.text.slice(0, 80).trim() : item.title;

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
        content: item.text,
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
      await insertChunks(tx, id, item.text);
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
        content: item.text,
        publishedAt: item.publishedAt,
        fetchedAt: now,
        contentHash,
        version: existing.version + 1,
      })
      .where(eq(documents.id, id));
    await insertChunks(tx, id, item.text);
    return "updated" as const;
  });
}

function normalizedFeedItem(item: FeedItem): NormalizedItem {
  return {
    title: item.title,
    link: item.link,
    publishedAt: item.publishedAt,
    text: htmlToText(item.html),
  };
}

function normalizedHtmlItem(item: HtmlItem): NormalizedItem {
  return {
    title: item.title,
    link: item.link,
    publishedAt: item.publishedAt,
    text: item.text,
  };
}

function feedCacheKey(source: SourceRow): string {
  return `${source.fetchKind}:${source.url}:${source.fetchConfig?.timeoutMs ?? 20_000}`;
}

async function cachedFeed(
  source: SourceRow,
  cache: FeedCache,
): Promise<FeedItem[]> {
  const key = feedCacheKey(source);
  let request = cache.get(key);
  if (!request) {
    request = fetchFeed(source.url, source.fetchConfig?.timeoutMs ?? 20_000);
    cache.set(key, request);
  }

  try {
    return await request;
  } catch (error) {
    if (cache.get(key) === request) cache.delete(key);
    throw error;
  }
}

async function recordSourceFailure(
  source: SourceRow,
  startedAt: Date,
  counts: SourceCounts,
): Promise<void> {
  try {
    await db
      .update(sources)
      .set({
        lastFetchAt: startedAt,
        consecutiveFailures: sql`${sources.consecutiveFailures} + 1`,
      })
      .where(eq(sources.id, source.id));
  } catch (error) {
    counts.errors.push(`source health update failed: ${errorText(error)}`);
  }

  try {
    await db.insert(ingestionRuns).values({
      sourceId: source.id,
      status: "error",
      documentsAdded: counts.added,
      documentsUpdated: counts.updated,
      errors: counts.errors,
      startedAt,
      finishedAt: new Date(),
    });
  } catch (error) {
    counts.errors.push(`ingestion run record failed: ${errorText(error)}`);
  }
}

function resultForSource(
  source: SourceRow,
  counts: SourceCounts,
  failed: boolean,
): SourceResult {
  return {
    sourceId: source.id,
    sourcesProcessed: 1,
    sourcesFailed: failed ? 1 : 0,
    added: counts.added,
    updated: counts.updated,
    unchanged: counts.unchanged,
    skipped: counts.skipped,
    errors: counts.errors.map((error) => `${source.id}: ${error}`),
  };
}

async function processSource(
  source: SourceRow,
  options: IngestOptions,
  feedCache: FeedCache,
): Promise<SourceResult> {
  const startedAt = new Date();
  const counts: SourceCounts = {
    added: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    errors: [],
  };
  const keywords = source.includeKeywords.map((keyword) =>
    keyword.toLowerCase(),
  );
  let relevantCount = 0;

  const processItem = async (item: NormalizedItem): Promise<void> => {
    const haystack = `${item.title}\n${item.text}`.toLowerCase();
    if (
      keywords.length > 0 &&
      !keywords.some((keyword) => haystack.includes(keyword))
    ) {
      return;
    }

    if (options.limitPerSource && relevantCount >= options.limitPerSource) {
      return;
    }
    relevantCount += 1;

    if (item.text.length < MIN_DOCUMENT_TEXT_LENGTH) {
      counts.skipped += 1;
      return;
    }

    try {
      const result = await upsertDocument(source, item);
      if (result === "added") counts.added += 1;
      else if (result === "updated") counts.updated += 1;
      else counts.unchanged += 1;
    } catch (error) {
      counts.errors.push(`${item.link}: ${errorText(error)}`);
    }
  };

  try {
    if (source.fetchKind === "rss") {
      const rawItems = await cachedFeed(source, feedCache);
      if (rawItems.length === 0) {
        throw new Error(
          "feed returned no items — likely not RSS (check the URL)",
        );
      }
      for (const item of rawItems) {
        await processItem(normalizedFeedItem(item));
      }
    } else if (source.fetchKind === "html") {
      const fetched = await fetchHtmlItems(source, async (item) => {
        await processItem(normalizedHtmlItem(item));
      });
      counts.errors.push(...fetched.errors);
      if (fetched.itemsFound === 0 && fetched.errors.length === 0) {
        throw new Error("HTML source returned no items (check the selectors)");
      }
    } else {
      throw new Error(`Unsupported fetch kind: ${source.fetchKind}`);
    }

    const productive = counts.added + counts.updated + counts.unchanged > 0;
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
      status: counts.errors.length > 0 ? "partial" : "success",
      documentsAdded: counts.added,
      documentsUpdated: counts.updated,
      errors: counts.errors,
      startedAt,
      finishedAt: new Date(),
    });
    return resultForSource(source, counts, false);
  } catch (error) {
    counts.errors.push(errorText(error));
    await recordSourceFailure(source, startedAt, counts);
    return resultForSource(source, counts, true);
  }
}

async function ingestSourcesUnlocked(
  options: IngestOptions,
): Promise<IngestSummary> {
  try {
    await cleanupExpired();
  } catch {
    // Cleanup must never block ingestion.
  }

  const enabledSources = await db
    .select()
    .from(sources)
    .where(eq(sources.enabled, true));
  const selected = shuffle(
    enabledSources.filter(
      (source) =>
        (!options.sourceId || source.id === options.sourceId) &&
        (!options.country || source.country === options.country),
    ),
  );
  const cache: FeedCache = new Map();
  const results: Array<SourceResult | undefined> = new Array(selected.length);
  const workerCount = Math.min(sourceConcurrency(options), selected.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < selected.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await processSource(selected[index], options, cache);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const summary = emptySummary("completed", 0);
  for (const result of results) {
    if (!result) continue;
    summary.sourcesProcessed += result.sourcesProcessed;
    summary.sourcesFailed += result.sourcesFailed;
    summary.added += result.added;
    summary.updated += result.updated;
    summary.unchanged += result.unchanged;
    summary.skipped += result.skipped;
    summary.errors.push(...result.errors);
    console.log(
      `${result.sourceId}: +${result.added} new, ${result.updated} updated, ${result.unchanged} unchanged${result.errors.length ? `, ${result.errors.length} errors` : ""}`,
    );
  }

  console.log(
    `Ingest source order: ${selected.map((source) => source.id).join(", ")}`,
  );
  return summary;
}

export async function ingestSources(
  options: IngestOptions = {},
): Promise<IngestSummary> {
  const startedAt = Date.now();
  const locked = await withIngestLock(() => ingestSourcesUnlocked(options));
  if (!locked.acquired) {
    return emptySummary("skipped", Date.now() - startedAt);
  }
  return {
    ...locked.value,
    status: "completed",
    durationMs: Date.now() - startedAt,
  };
}
