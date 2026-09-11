import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export interface SearchOptions {
  query: string;
  country?: string;
  regionLabel?: string;
  limit?: number;
}

export interface RetrievedChunk {
  chunkId: number;
  documentId: string;
  content: string;
  title: string;
  url: string;
  publisher: string;
  tier: number;
  country: string;
  publishedAt: Date | null;
  fetchedAt: Date;
  rank: number;
  matchedTerms: number;
  coverage: number;
  relevance: number;
  score: number;
}

/**
 * Ranking is deliberately explicit and inspectable: AI understands the
 * question, but retrieval and verification rules stay deterministic.
 * Coverage is IDF-weighted so rare terms (Garissa, Benue, cholera) count
 * more than generic ones (Kenya, county), and relevance dominates so tier
 * and freshness can never promote an off-topic document into evidence.
 */
export const SCORE_WEIGHTS = {
  relevance: 3,
  locality: 1.2,
  tier: 0.5,
  freshness: 0.6,
} as const;

export const MIN_WEIGHTED_COVERAGE = 0.3;
export const MIN_MATCHED_TERMS = 2;
const MAX_TERMS = 16;

interface RawChunkRow {
  chunk_id: number | string;
  document_id: string;
  content: string;
  title: string;
  url: string;
  publisher: string;
  tier: number | string;
  country: string;
  published_at: string | Date | null;
  fetched_at: string | Date | null;
  rank: number | string;
}

function toDate(value: string | Date | null): Date | null {
  if (value == null) return null;
  return value instanceof Date ? value : new Date(value);
}

export function tokenize(query: string): string[] {
  const terms = query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  return Array.from(new Set(terms)).slice(0, MAX_TERMS);
}

export function buildTsQuery(terms: string[]): string {
  return terms.join(" | ");
}

/**
 * IDF over chunks in the same country scope, used to weight term matches.
 * Uses `to_tsquery` so counts respect the English stemmer.
 */
async function computeIdf(
  terms: string[],
  country?: string,
): Promise<Map<string, number>> {
  const idf = new Map<string, number>();
  if (terms.length === 0) return idf;

  const totalRows = await db.execute(
    sql`SELECT count(*)::int AS total FROM documents ${country ? sql`WHERE country = ${country}` : sql``}`,
  );
  const total = Number(
    (totalRows as unknown as { total: number }[])[0]?.total ?? 0,
  );

  for (const term of terms) {
    const rows = await db.execute(sql`
      SELECT count(distinct d.id)::int AS df
      FROM document_chunks c
      JOIN documents d ON d.id = c.document_id
      WHERE to_tsvector('english', c.content) @@ to_tsquery('english', ${term})
        ${country ? sql`AND d.country = ${country}` : sql``}
    `);
    const df = Number((rows as unknown as { df: number }[])[0]?.df ?? 0);
    idf.set(term, Math.log((total + 1) / (df + 1)) + 1);
  }
  return idf;
}

export async function searchEvidence(
  options: SearchOptions,
): Promise<RetrievedChunk[]> {
  const terms = tokenize(options.query);
  const tsquery = buildTsQuery(terms);
  if (!tsquery) return [];
  const limit = options.limit ?? 12;

  const rows = await db.execute(sql`
    SELECT
      c.id AS chunk_id,
      c.document_id,
      c.content,
      d.title,
      d.url,
      d.published_at,
      d.fetched_at,
      d.tier,
      d.country,
      s.publisher,
      ts_rank(
        to_tsvector('english', c.content),
        to_tsquery('english', ${tsquery})
      ) AS rank
    FROM document_chunks c
    JOIN documents d ON d.id = c.document_id
    JOIN sources s ON s.id = d.source_id
    WHERE to_tsvector('english', c.content) @@ to_tsquery('english', ${tsquery})
      ${options.country ? sql`AND d.country = ${options.country}` : sql``}
    ORDER BY rank DESC, d.published_at DESC NULLS LAST
    LIMIT ${limit * 3}
  `);

  const idf = await computeIdf(terms, options.country);
  const totalIdf = terms.reduce((sum, term) => sum + (idf.get(term) ?? 1), 0);
  const now = Date.now();
  const region = options.regionLabel?.toLowerCase();

  const scored = (rows as unknown as RawChunkRow[])
    .map((row) => {
      const rank = Number(row.rank ?? 0);
      const content = row.content ?? "";
      const title = row.title ?? "";
      const haystack = `${title}\n${content}`.toLowerCase();

      let matchedIdf = 0;
      let matchedTerms = 0;
      for (const term of terms) {
        if (haystack.includes(term)) {
          matchedIdf += idf.get(term) ?? 1;
          matchedTerms += 1;
        }
      }
      const coverage = totalIdf > 0 ? matchedIdf / totalIdf : 0;
      const rankScore = Math.min(1, rank * 10);
      const relevance = 0.6 * coverage + 0.4 * rankScore;

      if (
        coverage < MIN_WEIGHTED_COVERAGE ||
        (terms.length >= 3 && matchedTerms < MIN_MATCHED_TERMS)
      ) {
        return null;
      }

      const locality =
        region && haystack.includes(region) ? SCORE_WEIGHTS.locality : 0;
      const tier = Number(row.tier);
      const tierBoost = tier === 1 ? 1 : tier === 2 ? 0.6 : 0.3;
      const fetchedAt = toDate(row.fetched_at) ?? new Date(0);
      const ageMs = Math.max(0, now - fetchedAt.getTime());
      const freshness = Math.max(0, 1 - ageMs / (7 * 86_400_000));
      const score =
        SCORE_WEIGHTS.relevance * relevance +
        locality +
        SCORE_WEIGHTS.tier * tierBoost +
        SCORE_WEIGHTS.freshness * freshness;

      return {
        chunkId: Number(row.chunk_id),
        documentId: String(row.document_id),
        content,
        title,
        url: String(row.url),
        publisher: String(row.publisher),
        tier,
        country: String(row.country),
        publishedAt: toDate(row.published_at),
        fetchedAt,
        rank,
        matchedTerms,
        coverage,
        relevance,
        score,
      } satisfies RetrievedChunk;
    })
    .filter((chunk): chunk is RetrievedChunk => chunk !== null);

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
