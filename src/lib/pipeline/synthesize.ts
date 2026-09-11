import { callStructured, type ChatMessage } from "@/lib/llm/client";
import { logLlmCall } from "@/lib/llm/log";
import { buildSynthesizeMessages, PROMPT_VERSIONS } from "@/lib/llm/prompts";
import type { SynthesizeReferral } from "@/lib/llm/prompts";
import type { RetrievedChunk } from "@/lib/retrieval/search";
import type { EvidenceAssessment } from "@/lib/trust/freshness";
import type {
  AnswerPayload,
  AnswerStatus,
  EvidenceItem,
  NextStep,
} from "@/lib/trust/types";
import { synthesisSchema, type Extraction, type Synthesis } from "./schemas";

export interface SynthesizeInput {
  claim: string;
  extraction: Extraction;
  assessment: EvidenceAssessment;
  evidence: RetrievedChunk[];
  referrals?: SynthesizeReferral[];
  country?: string;
  regionCode?: string;
  locationLabel?: string;
}

const CITATION_RE = /\[S(\d+)\]/g;

export function citationRefs(text: string): number[] {
  const refs: number[] = [];
  for (const match of text.matchAll(CITATION_RE)) {
    const value = Number(match[1]);
    if (Number.isFinite(value)) refs.push(value);
  }
  return refs;
}

export function validateSynthesis(
  synthesis: Synthesis,
  evidenceCount: number,
  status: AnswerStatus,
): string | null {
  const allText = [
    ...synthesis.what_we_know,
    ...synthesis.what_we_dont_know,
    ...synthesis.next_steps.flatMap((step) => [step.title, step.detail ?? ""]),
  ];

  for (const text of allText) {
    for (const ref of citationRefs(text)) {
      if (ref < 1 || ref > evidenceCount) {
        return `citation [S${ref}] does not match any provided evidence`;
      }
    }
  }

  if (status === "verified" || status === "developing") {
    if (synthesis.what_we_know.length === 0) {
      return "what_we_know must not be empty when evidence exists";
    }
    for (const bullet of synthesis.what_we_know) {
      if (citationRefs(bullet).length === 0) {
        return `every what_we_know bullet needs a citation; missing in: "${bullet.slice(0, 60)}"`;
      }
    }
  }

  return null;
}

function truncate(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function toEvidenceItem(chunk: RetrievedChunk): EvidenceItem {
  return {
    documentId: chunk.documentId,
    chunkId: chunk.chunkId,
    title: chunk.title,
    publisher: chunk.publisher,
    url: chunk.url,
    tier: chunk.tier,
    publishedAt: chunk.publishedAt?.toISOString() ?? null,
    fetchedAt: chunk.fetchedAt.toISOString(),
    excerpt: truncate(chunk.content, 240),
  };
}

function locationOf(input: SynthesizeInput) {
  const label =
    input.locationLabel ?? input.extraction.location_hints.join(", ");
  if (!label && !input.country) {
    return null;
  }
  return {
    country: input.country,
    regionCode: input.regionCode,
    label: label || input.country,
  };
}

function assemblePayload(
  input: SynthesizeInput,
  synthesis: Synthesis,
): AnswerPayload {
  return {
    claim: input.extraction.claim_text,
    answerLang: input.extraction.detected_lang,
    status: input.assessment.status,
    statusReason: input.assessment.reason,
    whatWeKnow: synthesis.what_we_know,
    whatWeDontKnow: synthesis.what_we_dont_know,
    evidence: input.evidence.map(toEvidenceItem),
    nextSteps: synthesis.next_steps.map((step): NextStep => ({
      title: step.title,
      detail: step.detail,
    })),
    location: locationOf(input),
    machineTranslated: input.extraction.detected_lang !== "en",
    checkedAt: new Date().toISOString(),
  };
}

export function fallbackPayload(
  input: SynthesizeInput,
  problem: string | null,
): AnswerPayload {
  const whatWeKnow = input.evidence
    .slice(0, 3)
    .map(
      (chunk, index) =>
        `${chunk.publisher}: ${truncate(chunk.content, 180)} [S${index + 1}]`,
    );
  const referralSteps: NextStep[] = (input.referrals ?? [])
    .slice(0, 2)
    .map((referral) => ({
      title: `Contact ${referral.name}`,
      detail: `${referral.phone}${referral.verified ? "" : " (confirm locally)"}${referral.description ? ` — ${referral.description}` : ""}`,
    }));

  return {
    claim: input.extraction.claim_text,
    answerLang: input.extraction.detected_lang,
    status: input.assessment.status,
    statusReason: input.assessment.reason,
    whatWeKnow,
    whatWeDontKnow: [
      problem
        ? "Amana could not produce a reviewed synthesis, so the bullets above are direct excerpts from the sources, not a verified summary."
        : "Amana could not run its full synthesis step, so these are direct excerpts from the sources above, not a verified summary.",
    ],
    evidence: input.evidence.map(toEvidenceItem),
    nextSteps: [
      ...referralSteps,
      {
        title: "Check with a trusted local source",
        detail:
          "Confirm with a local official, health worker, or community leader before acting or sharing.",
      },
      {
        title: "Do not forward yet",
        detail:
          "Unverified messages can cause panic or harm. Share the original source instead.",
      },
    ].slice(0, 3),
    location: locationOf(input),
    machineTranslated: input.extraction.detected_lang !== "en",
    checkedAt: new Date().toISOString(),
  };
}

export async function synthesizeAnswer(
  input: SynthesizeInput,
): Promise<AnswerPayload> {
  const baseMessages = buildSynthesizeMessages({
    claim: input.claim,
    answerLang: input.extraction.detected_lang,
    status: input.assessment.status,
    statusReason: input.assessment.reason,
    referrals: input.referrals ?? [],
    evidence: input.evidence.map((chunk, index) => ({
      index: index + 1,
      publisher: chunk.publisher,
      title: chunk.title,
      publishedAt: chunk.publishedAt,
      content: chunk.content,
    })),
  });

  let synthesis: Synthesis | null = null;
  let lastProblem: string | null = null;

  try {
    for (let attempt = 1; attempt <= 2 && synthesis === null; attempt += 1) {
      const messages: ChatMessage[] =
        lastProblem === null
          ? baseMessages
          : [
              ...baseMessages,
              {
                role: "user",
                content: `Your previous response was rejected: ${lastProblem}. Return corrected JSON only.`,
              },
            ];

      const result = await callStructured(synthesisSchema, messages, {
        stage: "synthesize",
        promptVersion: PROMPT_VERSIONS.synthesize,
        maxTokens: 6000,
        onCall: logLlmCall,
      });

      const problem = validateSynthesis(
        result.data,
        input.evidence.length,
        input.assessment.status,
      );
      if (problem) {
        lastProblem = problem;
        continue;
      }
      synthesis = result.data;
    }
  } catch {
    synthesis = null;
  }

  if (synthesis === null) {
    return fallbackPayload(input, lastProblem);
  }
  return assemblePayload(input, synthesis);
}
