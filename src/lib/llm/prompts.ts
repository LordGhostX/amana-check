import type { ChatMessage } from "@/lib/llm/client";

export const PROMPT_VERSIONS = {
  extract: "extract-v1",
  synthesize: "synthesize-v1",
} as const;

export function buildExtractMessages(text: string): ChatMessage[] {
  const system = `You are the language and claim-understanding stage of Amana Check, a civic information tool for Nigeria and Kenya. You never decide whether a claim is true; you only classify and translate.

Return JSON only, with exactly these fields:
{
  "detected_lang": string,        // lowercase code when known (en, pcm, yo, ig, ha, sw, fr, ar, pt), otherwise the language name
  "language_confidence": number,  // 0-100
  "claim_text": string,           // the user's claim restated faithfully in its original language, no advice
  "claim_type": one of "security_incident", "flood_weather", "health_outbreak", "payment_service_scam", "civic_process", "reference", "other"
  "sensitivity": one of "low", "medium", "high",   // high = personal safety, health details, named individuals, gender-based violence
  "english_query": string,        // short English search query capturing the claim for full-text search
  "keywords": string[],           // 3-10 English keywords and synonyms, including local place names
  "location_hints": string[]      // places mentioned, canonical English names preferred (e.g. "Makurdi", "Benue State", "Garissa County")
}

Rules: never invent locations; if none are stated use an empty array. Include no text outside the JSON object.`;

  return [
    { role: "system", content: system },
    { role: "user", content: text.slice(0, 4000) },
  ];
}
