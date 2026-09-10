import { z } from "zod";
import { CLAIM_TYPES, SENSITIVITY_LEVELS } from "@/lib/trust/types";

export const extractionSchema = z.object({
  detected_lang: z.string().min(2).max(20),
  language_confidence: z.number().min(0).max(100),
  claim_text: z.string().min(1).max(4000),
  claim_type: z.enum(CLAIM_TYPES),
  sensitivity: z.enum(SENSITIVITY_LEVELS),
  english_query: z.string().min(1).max(500),
  keywords: z.array(z.string().min(1)).min(1).max(12),
  location_hints: z.array(z.string().min(1)).max(8),
});

export type Extraction = z.infer<typeof extractionSchema>;

export const synthesisSchema = z.object({
  what_we_know: z.array(z.string().min(1).max(600)).max(3),
  what_we_dont_know: z.array(z.string().min(1).max(600)).max(3),
  next_steps: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        detail: z.string().max(320).optional(),
      }),
    )
    .max(3),
  answer_lang: z.string().min(2).max(20),
});

export type Synthesis = z.infer<typeof synthesisSchema>;
