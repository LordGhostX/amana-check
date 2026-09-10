import type { ChatMessage } from "@/lib/llm/client";
import type { AnswerStatus } from "@/lib/trust/types";

export const PROMPT_VERSIONS = {
  extract: "extract-v2",
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

Claim type definitions:
- security_incident: violence, attacks, kidnapping, banditry, unrest, curfews, crime, or military/police operations.
- flood_weather: floods, storms, drought, weather warnings, or related displacement.
- health_outbreak: disease outbreaks, epidemics, vaccination campaigns, or health emergencies.
- payment_service_scam: any message asking people to register, pay, send personal or banking details, or click a link to receive money, a grant, a job, or a government benefit. Choose this even when a real programme is named, if the message pushes registration, payment, or personal details.
- civic_process: government procedures, deadlines, documents, elections, or policy announcements that do not ask for money or personal details.
- reference: rights, entitlements, or how-to information that is not time-sensitive.
- other: anything that does not fit.

Rules: never invent locations; if none are stated use an empty array. Include no text outside the JSON object.`;

  return [
    { role: "system", content: system },
    { role: "user", content: text.slice(0, 4000) },
  ];
}

export interface SynthesizeEvidence {
  index: number;
  publisher: string;
  title: string;
  publishedAt: Date | null;
  content: string;
}

export interface SynthesizeReferral {
  name: string;
  phone: string;
  description?: string | null;
  verified: boolean;
}

export interface SynthesizePromptInput {
  claim: string;
  answerLang: string;
  status: AnswerStatus;
  statusReason: string;
  evidence: SynthesizeEvidence[];
  referrals: SynthesizeReferral[];
}

export function buildSynthesizeMessages(
  input: SynthesizePromptInput,
): ChatMessage[] {
  const system = `You are the answer-writing stage of Amana Check, a civic information tool for Nigeria and Kenya. You write for people who may be on a basic phone or a slow connection.

You receive the user's claim, a fixed verification status decided by the system, and numbered evidence excerpts. You must never change or contradict the status. Use only the provided evidence: never add facts, names, phone numbers, links, or figures that are not in the evidence.

Write in the user's detected language (${input.answerLang}). Keep sentences short and plain. No jargon and no advice beyond practical next steps.

In next_steps you may mention at most two ACTION CONTACTS, and only when directly relevant to the claim. Never invent phone numbers, links, office names, or fees. If a contact is marked not verified, tell the user to confirm it locally before relying on it.

Return JSON only with exactly these fields:
{
  "what_we_know": string[],       // up to 3 short bullets. Every factual bullet must end with its citation marker, e.g. [S1] or [S2][S3]. Use an empty array when there is no evidence.
  "what_we_dont_know": string[],  // up to 3 short bullets stating exactly what is unknown or uncertain, including why no verdict was possible.
  "next_steps": [{"title": string, "detail": string}],  // up to 3 practical actions that require no payment and no invented contacts.
  "answer_lang": string           // the language code you wrote in.
}`;

  const evidenceBlock =
    input.evidence.length === 0
      ? "EVIDENCE: none found."
      : `EVIDENCE:\n${input.evidence
          .map(
            (item) =>
              `[S${item.index}] (${item.publisher}, ${item.publishedAt ? item.publishedAt.toISOString().slice(0, 10) : "date unknown"}) ${item.title}\n${item.content.slice(0, 700)}`,
          )
          .join("\n\n")}`;

  const referralsBlock =
    input.referrals.length === 0
      ? "ACTION CONTACTS: none available."
      : `ACTION CONTACTS (only these may be mentioned; unverified = tell the user to confirm locally):\n${input.referrals
          .map(
            (referral) =>
              `- ${referral.name} — ${referral.phone}${referral.description ? ` — ${referral.description}` : ""}${referral.verified ? " (verified)" : " (not yet verified)"}`,
          )
          .join("\n")}`;

  const user = `CLAIM: ${input.claim}
STATUS: ${input.status}
STATUS REASON (fixed by the system): ${input.statusReason}

${evidenceBlock}

${referralsBlock}`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
