import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { answerVersions, answers, claims } from "@/lib/db/schema";
import { PROMPT_VERSIONS } from "@/lib/llm/prompts";
import { corpusNewest } from "@/lib/retrieval/corpus";
import { searchEvidence, type RetrievedChunk } from "@/lib/retrieval/search";
import { assessEvidence, type EvidenceAssessment } from "@/lib/trust/freshness";
import type { AnswerPayload } from "@/lib/trust/types";
import { clusterKeyFor, recordVerificationDemand } from "./events";
import { extractClaim } from "./extract";
import type { Extraction } from "./schemas";
import { synthesizeAnswer } from "./synthesize";

export interface AskOptions {
  text: string;
  country?: string;
  regionCode?: string;
  bypassCache?: boolean;
}

export interface AskResult {
  answerId: number;
  claimHash: string;
  version: number;
  cached: boolean;
  payload: AnswerPayload;
  extraction: Extraction;
  evidence: RetrievedChunk[];
  assessment: EvidenceAssessment;
}

export function claimHashFor(extraction: Extraction, country?: string): string {
  const normalized = extraction.english_query
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha256")
    .update(`${normalized}|${extraction.claim_type}|${country ?? ""}`)
    .digest("hex");
}

function cachedAssessment(payload: AnswerPayload): EvidenceAssessment {
  return {
    status: payload.status,
    reason: payload.statusReason,
    windowMs: 0,
    newestEvidenceAt: null,
    stale: payload.status === "not_confirmed_stale",
  };
}

export async function answerClaim(options: AskOptions): Promise<AskResult> {
  const extraction = await extractClaim(options.text);
  const claimHash = claimHashFor(extraction, options.country);
  const lang = extraction.detected_lang;

  if (!options.bypassCache) {
    const cachedRows = await db
      .select()
      .from(answers)
      .where(and(eq(answers.claimHash, claimHash), eq(answers.lang, lang)))
      .limit(1);
    const cached = cachedRows[0];
    if (cached) {
      return {
        answerId: cached.id,
        claimHash,
        version: cached.version,
        cached: true,
        payload: cached.payload,
        extraction,
        evidence: [],
        assessment: cachedAssessment(cached.payload),
      };
    }
  }

  const evidence = await searchEvidence({
    query: [extraction.english_query, ...extraction.keywords].join(" "),
    country: options.country,
    regionLabel: extraction.location_hints[0],
    limit: 8,
  });
  const newest = await corpusNewest(options.country);
  const assessment = assessEvidence(
    extraction.claim_type,
    evidence.map((item) => ({
      tier: item.tier,
      publisher: item.publisher,
      publishedAt: item.publishedAt,
      fetchedAt: item.fetchedAt,
    })),
    newest,
  );

  const payload = await synthesizeAnswer({
    claim: extraction.claim_text,
    extraction,
    assessment,
    evidence,
    country: options.country,
    regionCode: options.regionCode,
  });

  await db.insert(claims).values({
    claimHash,
    claimText: extraction.claim_text,
    englishQuery: extraction.english_query,
    keywords: extraction.keywords,
    locationHints: extraction.location_hints,
    detectedLang: lang,
    languageConfidence: Math.round(extraction.language_confidence),
    claimType: extraction.claim_type,
    sensitivity: extraction.sensitivity,
    country: options.country ?? null,
    regionCode: options.regionCode ?? null,
    locationText: extraction.location_hints.join(", ") || null,
  });

  const existingRows = await db
    .select({ id: answers.id, version: answers.version })
    .from(answers)
    .where(and(eq(answers.claimHash, claimHash), eq(answers.lang, lang)))
    .limit(1);
  const existing = existingRows[0];
  let answerId: number;
  let version: number;
  let changeReason: string;

  if (!existing) {
    const inserted = await db
      .insert(answers)
      .values({
        claimHash,
        lang,
        status: payload.status,
        claimType: extraction.claim_type,
        payload,
        promptVersion: PROMPT_VERSIONS.synthesize,
        version: 1,
      })
      .returning({ id: answers.id });
    answerId = inserted[0]!.id;
    version = 1;
    changeReason = "initial";
  } else {
    answerId = existing.id;
    version = existing.version + 1;
    changeReason = "recheck";
    await db
      .update(answers)
      .set({ status: payload.status, payload, version, updatedAt: new Date() })
      .where(eq(answers.id, answerId));
  }

  await db.insert(answerVersions).values({
    answerId,
    version,
    status: payload.status,
    payload,
    changeReason,
  });

  try {
    await recordVerificationDemand({
      country: options.country,
      regionCode: options.regionCode,
      claimType: extraction.claim_type,
      clusterKey: clusterKeyFor(extraction, options.country),
      status: payload.status,
    });
  } catch {
    // Demand aggregation must never break answering.
  }

  return {
    answerId,
    claimHash,
    version,
    cached: false,
    payload,
    extraction,
    evidence,
    assessment,
  };
}
