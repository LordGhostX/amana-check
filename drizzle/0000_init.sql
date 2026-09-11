CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TABLE "answer_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"answer_id" integer NOT NULL,
	"version" integer NOT NULL,
	"status" text NOT NULL,
	"payload" jsonb NOT NULL,
	"change_reason" text,
	"reviewer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"claim_hash" text NOT NULL,
	"lang" text NOT NULL,
	"status" text NOT NULL,
	"claim_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"prompt_version" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"review_state" text DEFAULT 'unreviewed' NOT NULL,
	"review_note" text,
	"reviewed_at" timestamp with time zone,
	"reviewer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"claim_hash" text NOT NULL,
	"claim_text" text NOT NULL,
	"english_query" text,
	"keywords" jsonb,
	"location_hints" jsonb,
	"detected_lang" text,
	"language_confidence" integer,
	"claim_type" text,
	"sensitivity" text,
	"country" text,
	"region_code" text,
	"location_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"content" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"version" integer NOT NULL,
	"content_hash" text NOT NULL,
	"snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"content" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"published_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_verified_at" timestamp with time zone,
	"country" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tier" integer NOT NULL,
	"license" text,
	"content_hash" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"bucket_date" date NOT NULL,
	"country" text NOT NULL,
	"region" text NOT NULL,
	"topic" text NOT NULL,
	"claim_cluster" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"status_distribution" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"answer_id" integer,
	"rating" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" text,
	"status" text NOT NULL,
	"documents_added" integer DEFAULT 0 NOT NULL,
	"documents_updated" integer DEFAULT 0 NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "llm_calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text,
	"stage" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6),
	"success" boolean DEFAULT true NOT NULL,
	"error_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"ip_hash" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_ip_hash_window_start_pk" PRIMARY KEY("ip_hash","window_start")
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"country" text NOT NULL,
	"region_code" text,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"description" text,
	"url" text,
	"verified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" serial PRIMARY KEY NOT NULL,
	"country" text NOT NULL,
	"level" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"parent_code" text
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"publisher" text NOT NULL,
	"type" text NOT NULL,
	"tier" integer NOT NULL,
	"country" text NOT NULL,
	"scope" jsonb DEFAULT '["national"]'::jsonb NOT NULL,
	"fetch_kind" text NOT NULL,
	"url" text NOT NULL,
	"fetch_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"license" text,
	"refresh_interval" text,
	"include_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_fetch_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"zero_yield_streak" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "answer_versions" ADD CONSTRAINT "answer_versions_answer_id_answers_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."answers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_answer_id_answers_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."answers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "answer_versions_answer_idx" ON "answer_versions" USING btree ("answer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "answers_claim_lang_idx" ON "answers" USING btree ("claim_hash","lang");--> statement-breakpoint
CREATE INDEX "claims_hash_idx" ON "claims" USING btree ("claim_hash");--> statement-breakpoint
CREATE INDEX "claims_created_idx" ON "claims" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "chunks_search_idx" ON "document_chunks" USING gin (to_tsvector('english', "content"));--> statement-breakpoint
CREATE INDEX "chunks_document_idx" ON "document_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_versions_document_idx" ON "document_versions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "documents_search_idx" ON "documents" USING gin (to_tsvector('english', "title" || ' ' || "content"));--> statement-breakpoint
CREATE INDEX "documents_country_idx" ON "documents" USING btree ("country");--> statement-breakpoint
CREATE INDEX "documents_published_idx" ON "documents" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "documents_source_idx" ON "documents" USING btree ("source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "events_bucket_idx" ON "events" USING btree ("bucket_date","country","region","topic","claim_cluster");--> statement-breakpoint
CREATE INDEX "llm_calls_created_idx" ON "llm_calls" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_slug_idx" ON "referrals" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "referrals_country_idx" ON "referrals" USING btree ("country");--> statement-breakpoint
CREATE INDEX "referrals_category_idx" ON "referrals" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "regions_code_idx" ON "regions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "regions_country_idx" ON "regions" USING btree ("country");--> statement-breakpoint
CREATE INDEX "regions_name_trgm_idx" ON "regions" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "sources_country_idx" ON "sources" USING btree ("country");
