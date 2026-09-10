import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { answerVersions, answers } from "@/lib/db/schema";
import type { AnswerPayload, AnswerStatus } from "@/lib/trust/types";

export const DEMAND_DISCLAIMER =
  "Aggregated verification demand. This dashboard does not represent confirmed incidents.";

export interface ReviewQueueItem {
  answerId: number;
  version: number;
  status: AnswerStatus;
  claimType: string;
  lang: string;
  claim: string;
  updatedAt: string;
  reviewState: string;
  reviewNote: string | null;
  reviewer: string | null;
  evidenceCount: number;
  whatWeKnow: string[];
  whatWeDontKnow: string[];
}

export async function listReviewQueue(
  options: { limit?: number; includeReviewed?: boolean } = {},
): Promise<ReviewQueueItem[]> {
  const rows = await db
    .select()
    .from(answers)
    .where(
      options.includeReviewed
        ? sql`true`
        : eq(answers.reviewState, "unreviewed"),
    )
    .orderBy(sql`${answers.updatedAt} DESC`)
    .limit(options.limit ?? 40);

  return rows.map((row) => ({
    answerId: row.id,
    version: row.version,
    status: row.status,
    claimType: row.claimType,
    lang: row.lang,
    claim: row.payload.claim,
    updatedAt: row.updatedAt.toISOString(),
    reviewState: row.reviewState,
    reviewNote: row.reviewNote,
    reviewer: row.reviewer,
    evidenceCount: row.payload.evidence.length,
    whatWeKnow: row.payload.whatWeKnow,
    whatWeDontKnow: row.payload.whatWeDontKnow,
  }));
}

async function loadAnswer(answerId: number) {
  const rows = await db
    .select()
    .from(answers)
    .where(eq(answers.id, answerId))
    .limit(1);
  const answer = rows[0];
  if (!answer) throw new Error(`answer ${answerId} not found`);
  return answer;
}

export async function approveAnswer(
  answerId: number,
  reviewer: string,
  note?: string,
): Promise<{ version: number; status: AnswerStatus }> {
  const answer = await loadAnswer(answerId);
  const version = answer.version + 1;
  const reviewedAt = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(answers)
      .set({
        reviewState: "approved",
        reviewedAt,
        reviewer,
        reviewNote: note ?? null,
        version,
        updatedAt: reviewedAt,
      })
      .where(eq(answers.id, answerId));
    await tx.insert(answerVersions).values({
      answerId,
      version,
      status: answer.status,
      payload: answer.payload,
      changeReason: "human_reviewed",
      reviewer,
    });
  });

  return { version, status: answer.status };
}

export interface CorrectionInput {
  status?: AnswerStatus;
  whatWeKnow?: string[];
  whatWeDontKnow?: string[];
  note?: string;
}

export async function correctAnswer(
  answerId: number,
  reviewer: string,
  input: CorrectionInput,
): Promise<{ version: number; status: AnswerStatus }> {
  const answer = await loadAnswer(answerId);
  const status = input.status ?? answer.status;
  const reviewedAt = new Date();
  const version = answer.version + 1;

  const payload: AnswerPayload = {
    ...answer.payload,
    status,
    statusReason: input.note
      ? `Reviewed by a person: ${input.note}`
      : answer.payload.statusReason,
    whatWeKnow: input.whatWeKnow ?? answer.payload.whatWeKnow,
    whatWeDontKnow: input.whatWeDontKnow ?? answer.payload.whatWeDontKnow,
    checkedAt: reviewedAt.toISOString(),
  };

  await db.transaction(async (tx) => {
    await tx
      .update(answers)
      .set({
        status,
        payload,
        reviewState: "corrected",
        reviewedAt,
        reviewer,
        reviewNote: input.note ?? null,
        version,
        updatedAt: reviewedAt,
      })
      .where(eq(answers.id, answerId));
    await tx.insert(answerVersions).values({
      answerId,
      version,
      status,
      payload,
      changeReason: "human_corrected",
      reviewer,
    });
  });

  return { version, status };
}

export interface DemandBucket {
  bucketDate: string;
  country: string;
  region: string;
  topic: string;
  claimCluster: string;
  count: number;
  statusDistribution: Record<string, number>;
}

export interface DashboardData {
  buckets: DemandBucket[];
  totalChecks: number;
  distinctClusters: number;
  days: number;
  disclaimer: string;
  suppression: string;
}

interface RawDemandRow {
  bucket_date: string;
  country: string;
  region: string;
  topic: string;
  claim_cluster: string;
  count: number;
  status_distribution: Record<string, number>;
}

async function demandRows(
  days: number,
  limit: number,
): Promise<DemandBucket[]> {
  const rows = await db.execute(sql`
    SELECT
      bucket_date::text AS bucket_date,
      country,
      region,
      topic,
      claim_cluster,
      count,
      status_distribution
    FROM events
    WHERE bucket_date >= (current_date - ${days}::int)
      AND count >= 3
    ORDER BY bucket_date DESC, count DESC
    LIMIT ${limit}
  `);

  return (rows as unknown as RawDemandRow[]).map((row) => ({
    bucketDate: row.bucket_date,
    country: row.country,
    region: row.region,
    topic: row.topic,
    claimCluster: row.claim_cluster,
    count: Number(row.count),
    statusDistribution: row.status_distribution ?? {},
  }));
}

export async function dashboardData(days = 7): Promise<DashboardData> {
  const buckets = await demandRows(days, 200);
  return {
    buckets,
    totalChecks: buckets.reduce((sum, bucket) => sum + bucket.count, 0),
    distinctClusters: new Set(
      buckets.map(
        (bucket) => `${bucket.country}:${bucket.region}:${bucket.claimCluster}`,
      ),
    ).size,
    days,
    disclaimer: DEMAND_DISCLAIMER,
    suppression: "Buckets below three checks are suppressed.",
  };
}

export async function briefRows(days = 30): Promise<DemandBucket[]> {
  return demandRows(days, 1000);
}

export function briefToCsv(rows: DemandBucket[]): string {
  const header =
    "bucket_date,country,region,topic,claim_cluster,count,status_distribution";
  const lines = rows.map((row) =>
    [
      row.bucketDate,
      row.country,
      row.region,
      row.topic,
      row.claimCluster,
      row.count,
      JSON.stringify(row.statusDistribution),
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header, ...lines].join("\n");
}

export interface SourceHealthItem {
  id: string;
  publisher: string;
  country: string;
  type: string;
  tier: number;
  enabled: boolean;
  lastSuccessAt: string | null;
  consecutiveFailures: number;
  zeroYieldStreak: number;
  lastRunAdded: number | null;
  lastRunUpdated: number | null;
}

interface RawSourceHealthRow {
  id: string;
  publisher: string;
  country: string;
  type: string;
  tier: number;
  enabled: boolean;
  last_success_at: string | Date | null;
  consecutive_failures: number;
  zero_yield_streak: number;
  last_run_added: number | null;
  last_run_updated: number | null;
}

/**
 * Green "last success" can hide a source that fetches fine but never yields
 * documents, so the zero-yield streak is surfaced alongside it.
 */
export async function sourceHealth(): Promise<SourceHealthItem[]> {
  const rows = await db.execute(sql`
    SELECT
      s.id,
      s.publisher,
      s.country,
      s.type,
      s.tier,
      s.enabled,
      s.last_success_at,
      s.consecutive_failures,
      s.zero_yield_streak,
      r.documents_added AS last_run_added,
      r.documents_updated AS last_run_updated
    FROM sources s
    LEFT JOIN LATERAL (
      SELECT documents_added, documents_updated
      FROM ingestion_runs
      WHERE source_id = s.id
      ORDER BY started_at DESC
      LIMIT 1
    ) r ON true
    ORDER BY s.enabled DESC, s.country, s.id
  `);

  return (rows as unknown as RawSourceHealthRow[]).map((row) => ({
    id: row.id,
    publisher: row.publisher,
    country: row.country,
    type: row.type,
    tier: Number(row.tier),
    enabled: row.enabled,
    lastSuccessAt: row.last_success_at
      ? new Date(row.last_success_at).toISOString()
      : null,
    consecutiveFailures: Number(row.consecutive_failures),
    zeroYieldStreak: Number(row.zero_yield_streak),
    lastRunAdded:
      row.last_run_added == null ? null : Number(row.last_run_added),
    lastRunUpdated:
      row.last_run_updated == null ? null : Number(row.last_run_updated),
  }));
}
