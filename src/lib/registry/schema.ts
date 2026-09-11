import { z } from "zod";
import { FETCH_KINDS, SOURCE_TYPES } from "@/lib/trust/types";

export const sourceEntrySchema = z.object({
  id: z.string().min(1),
  publisher: z.string().min(1),
  type: z.enum(SOURCE_TYPES),
  tier: z.number().int().min(1).max(3),
  scope: z.array(z.string().min(1)).min(1),
  fetch: z.object({
    kind: z.enum(FETCH_KINDS),
    url: z.url(),
    list_selector: z.string().optional(),
    link_pattern: z.string().optional(),
    content_selector: z.string().optional(),
    title_selector: z.string().optional(),
    date_selector: z.string().optional(),
    max_items: z.number().int().min(1).max(100).optional(),
    timeout_ms: z.number().int().min(5000).max(120000).optional(),
  }),
  license: z.string().optional(),
  refresh_interval: z.string().nullable().optional(),
  include_keywords: z.array(z.string().min(1)).optional(),
  enabled: z.boolean().default(true),
});

export const sourceFileSchema = z.object({
  country: z.string().length(2),
  sources: z.array(sourceEntrySchema).min(1),
});

export const regionEntrySchema = z.object({
  code: z.string().min(2),
  level: z.enum(["country", "state", "county"]),
  name: z.string().min(1),
  parentCode: z.string().nullable(),
});

export const regionFileSchema = z.object({
  country: z.string().length(2),
  name: z.string().min(1),
  regions: z.array(regionEntrySchema).min(1),
});

export type SourceEntry = z.infer<typeof sourceEntrySchema>;
export type SourceFile = z.infer<typeof sourceFileSchema>;
export type RegionFile = z.infer<typeof regionFileSchema>;

export const referralEntrySchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "slug must be kebab-case")
    .min(3)
    .max(60),
  regionCode: z.string().nullable().optional(),
  category: z.enum([
    "emergency",
    "health",
    "gbv",
    "child",
    "legal",
    "civic",
    "humanitarian",
  ]),
  name: z.string().min(1),
  phone: z.string().min(3),
  description: z.string().optional(),
  url: z.url().optional(),
  verifiedAt: z.string().nullable().optional(),
});

export const referralFileSchema = z.object({
  country: z.string().length(2),
  referrals: z.array(referralEntrySchema).min(1),
});

export type ReferralEntry = z.infer<typeof referralEntrySchema>;
export type ReferralFile = z.infer<typeof referralFileSchema>;
