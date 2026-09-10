ALTER TABLE "answer_versions" ADD COLUMN "reviewer" text;--> statement-breakpoint
ALTER TABLE "answers" ADD COLUMN "review_state" text DEFAULT 'unreviewed' NOT NULL;--> statement-breakpoint
ALTER TABLE "answers" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "answers" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "answers" ADD COLUMN "reviewer" text;