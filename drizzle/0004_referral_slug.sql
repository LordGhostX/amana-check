DELETE FROM "referrals";--> statement-breakpoint
ALTER TABLE "referrals" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_slug_idx" ON "referrals" USING btree ("slug");
