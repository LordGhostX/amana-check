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
    url: z.string().url(),
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
