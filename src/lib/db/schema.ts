import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  AnswerPayload,
  AnswerStatus,
  ClaimType,
  DocumentSnapshot,
  FetchKind,
  Sensitivity,
  SourceType,
} from "@/lib/trust/types";

export const regions = pgTable(
  "regions",
  {
    id: serial("id").primaryKey(),
    country: text("country").notNull(),
    level: text("level").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    parentCode: text("parent_code"),
  },
  (t) => [
    uniqueIndex("regions_code_idx").on(t.code),
    index("regions_country_idx").on(t.country),
    index("regions_name_trgm_idx").using("gin", sql`${t.name} gin_trgm_ops`),
  ],
);

export const sources = pgTable(
  "sources",
  {
    id: text("id").primaryKey(),
    publisher: text("publisher").notNull(),
    type: text("type").$type<SourceType>().notNull(),
    tier: integer("tier").notNull(),
    country: text("country").notNull(),
    scope: jsonb("scope").$type<string[]>().notNull().default(["national"]),
    fetchKind: text("fetch_kind").$type<FetchKind>().notNull(),
    url: text("url").notNull(),
    license: text("license"),
    refreshInterval: text("refresh_interval"),
    includeKeywords: jsonb("include_keywords")
      .$type<string[]>()
      .notNull()
      .default([]),
    enabled: boolean("enabled").notNull().default(true),
    lastFetchAt: timestamp("last_fetch_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    zeroYieldStreak: integer("zero_yield_streak").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("sources_country_idx").on(t.country)],
);

export const documents = pgTable(
  "documents",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url").notNull(),
    content: text("content").notNull(),
    language: text("language").notNull().default("en"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    country: text("country").notNull(),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    tier: integer("tier").notNull(),
    license: text("license"),
    contentHash: text("content_hash").notNull(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    index("documents_search_idx").using(
      "gin",
      sql`to_tsvector('english', ${t.title} || ' ' || ${t.content})`,
    ),
    index("documents_country_idx").on(t.country),
    index("documents_published_idx").on(t.publishedAt),
    index("documents_source_idx").on(t.sourceId),
  ],
);

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: serial("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    content: text("content").notNull(),
    page: integer("page"),
    anchor: text("anchor"),
  },
  (t) => [
    index("chunks_search_idx").using(
      "gin",
      sql`to_tsvector('english', ${t.content})`,
    ),
    index("chunks_document_idx").on(t.documentId),
  ],
);

export const documentVersions = pgTable(
  "document_versions",
  {
    id: serial("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    contentHash: text("content_hash").notNull(),
    snapshot: jsonb("snapshot").$type<DocumentSnapshot>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("document_versions_document_idx").on(t.documentId)],
);

export const ingestionRuns = pgTable("ingestion_runs", {
  id: serial("id").primaryKey(),
  sourceId: text("source_id"),
  status: text("status").notNull(),
  documentsAdded: integer("documents_added").notNull().default(0),
  documentsUpdated: integer("documents_updated").notNull().default(0),
  errors: jsonb("errors").$type<string[]>().notNull().default([]),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

/**
 * De-identified input corpus. Retained indefinitely by product decision.
 * No raw IPs, no device ids, no phone numbers, no join keys to locale_hints
 * or rate_limits may ever be added to this table.
 */
export const claims = pgTable(
  "claims",
  {
    id: serial("id").primaryKey(),
    claimHash: text("claim_hash").notNull(),
    claimText: text("claim_text").notNull(),
    englishQuery: text("english_query"),
    keywords: jsonb("keywords").$type<string[]>(),
    locationHints: jsonb("location_hints").$type<string[]>(),
    detectedLang: text("detected_lang"),
    languageConfidence: integer("language_confidence"),
    claimType: text("claim_type").$type<ClaimType>(),
    sensitivity: text("sensitivity").$type<Sensitivity>(),
    country: text("country"),
    regionCode: text("region_code"),
    locationText: text("location_text"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("claims_hash_idx").on(t.claimHash),
    index("claims_created_idx").on(t.createdAt),
  ],
);

export const answers = pgTable(
  "answers",
  {
    id: serial("id").primaryKey(),
    claimHash: text("claim_hash").notNull(),
    lang: text("lang").notNull(),
    status: text("status").$type<AnswerStatus>().notNull(),
    claimType: text("claim_type").$type<ClaimType>().notNull(),
    payload: jsonb("payload").$type<AnswerPayload>().notNull(),
    promptVersion: text("prompt_version").notNull(),
    version: integer("version").notNull().default(1),
    reviewState: text("review_state").notNull().default("unreviewed"),
    reviewNote: text("review_note"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewer: text("reviewer"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("answers_claim_lang_idx").on(t.claimHash, t.lang)],
);

export const answerVersions = pgTable(
  "answer_versions",
  {
    id: serial("id").primaryKey(),
    answerId: integer("answer_id")
      .notNull()
      .references(() => answers.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: text("status").$type<AnswerStatus>().notNull(),
    payload: jsonb("payload").$type<AnswerPayload>().notNull(),
    changeReason: text("change_reason"),
    reviewer: text("reviewer"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("answer_versions_answer_idx").on(t.answerId)],
);

export const referrals = pgTable(
  "referrals",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    country: text("country").notNull(),
    regionCode: text("region_code"),
    category: text("category").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    description: text("description"),
    url: text("url"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("referrals_slug_idx").on(t.slug),
    index("referrals_country_idx").on(t.country),
    index("referrals_category_idx").on(t.category),
  ],
);

/**
 * Aggregated verification demand only. Rows carry no identity and no free
 * text. The peacebuilder dashboard applies k >= 3 suppression at read time.
 */
export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    bucketDate: date("bucket_date").notNull(),
    country: text("country").notNull(),
    region: text("region").notNull(),
    topic: text("topic").notNull(),
    claimCluster: text("claim_cluster").notNull(),
    count: integer("count").notNull().default(0),
    statusDistribution: jsonb("status_distribution")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
  },
  (t) => [
    uniqueIndex("events_bucket_idx").on(
      t.bucketDate,
      t.country,
      t.region,
      t.topic,
      t.claimCluster,
    ),
  ],
);

export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  answerId: integer("answer_id").references(() => answers.id, {
    onDelete: "set null",
  }),
  claimHash: text("claim_hash"),
  rating: text("rating"),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const localeHints = pgTable("locale_hints", {
  ipHash: text("ip_hash").primaryKey(),
  locale: text("locale").notNull(),
  confidence: integer("confidence").notNull().default(0),
  hits: integer("hits").notNull().default(1),
  firstSeen: timestamp("first_seen", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeen: timestamp("last_seen", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const rateLimits = pgTable(
  "rate_limits",
  {
    ipHash: text("ip_hash").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.ipHash, t.windowStart] })],
);

export const llmCalls = pgTable(
  "llm_calls",
  {
    id: serial("id").primaryKey(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version"),
    stage: text("stage").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }),
    success: boolean("success").notNull().default(true),
    errorType: text("error_type"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("llm_calls_created_idx").on(t.createdAt)],
);
