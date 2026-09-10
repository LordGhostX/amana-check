import { callStructured } from "@/lib/llm/client";
import { logLlmCall } from "@/lib/llm/log";
import { buildExtractMessages, PROMPT_VERSIONS } from "@/lib/llm/prompts";
import { extractionSchema, type Extraction } from "./schemas";

export async function extractClaim(text: string): Promise<Extraction> {
  const trimmed = text.trim().slice(0, 4000);
  try {
    const result = await callStructured(
      extractionSchema,
      buildExtractMessages(trimmed),
      {
        stage: "extract",
        promptVersion: PROMPT_VERSIONS.extract,
        maxTokens: 2500,
        onCall: logLlmCall,
      },
    );
    return result.data;
  } catch {
    return fallbackExtraction(trimmed);
  }
}

export function fallbackExtraction(text: string): Extraction {
  const keywords = Array.from(
    new Set(text.toLowerCase().match(/[a-z]{4,}/g) ?? []),
  ).slice(0, 8);
  return {
    detected_lang: "en",
    language_confidence: 0,
    claim_text: text,
    claim_type: "other",
    sensitivity: "medium",
    english_query: text.slice(0, 300),
    keywords: keywords.length > 0 ? keywords : ["news"],
    location_hints: [],
  };
}
