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
