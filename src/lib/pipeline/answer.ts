import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { answerVersions, answers, claims } from "@/lib/db/schema";
import { PROMPT_VERSIONS } from "@/lib/llm/prompts";
import {
  resolveLocation,
  type LocationSource,
  type ResolvedLocation,
} from "@/lib/locale/precedence";
import { corpusNewest } from "@/lib/retrieval/corpus";
import { searchEvidence, type RetrievedChunk } from "@/lib/retrieval/search";
import { assessEvidence, type EvidenceAssessment } from "@/lib/trust/freshness";
import type { AnswerPayload, AnswerStatus } from "@/lib/trust/types";
import { clusterKeyFor, recordVerificationDemand } from "./events";
import { extractClaim } from "./extract";
import type { Extraction } from "./schemas";
import { synthesizeAnswer } from "./synthesize";

export interface AskOptions {
  text: string;
  fallbackCountry?: string;
  fallbackRegionCode?: string;
  fallbackSource?: LocationSource;
  bypassCache?: boolean;
}

export interface AnswerVersionInfo {
  version: number;
  status: AnswerStatus;
  changedAt: string;
  changeReason: string | null;
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
  location: ResolvedLocation;
  versions: AnswerVersionInfo[];
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

async function loadVersions(answerId: number): Promise<AnswerVersionInfo[]> {
  const rows = await db
    .select({
      version: answerVersions.version,
      status: answerVersions.status,
      changedAt: answerVersions.createdAt,
      changeReason: answerVersions.changeReason,
    })
    .from(answerVersions)
    .where(eq(answerVersions.answerId, answerId))
    .orderBy(desc(answerVersions.version))
    .limit(10);

  return rows.map((row) => ({
    version: row.version,
    status: row.status,
    changedAt: row.changedAt.toISOString(),
    changeReason: row.changeReason,
  }));
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

function cachedLocation(payload: AnswerPayload): ResolvedLocation {
  if (!payload.location) return { source: "cache" };
  return {
    country: payload.location.country,
    regionCode: payload.location.regionCode,
    regionName: payload.location.label,
    source: "cache",
  };
}

export async function answerClaim(options: AskOptions): Promise<AskResult> {
  const extraction = await extractClaim(options.text);
  const claimHash = claimHashFor(extraction, options.fallbackCountry);
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
        location: cachedLocation(cached.payload),
        versions: await loadVersions(cached.id),
      };
    }
  }

  const location = await resolveLocation({
    claimLocationHints: extraction.location_hints,
    fallback: {
      country: options.fallbackCountry,
      regionCode: options.fallbackRegionCode,
      source: options.fallbackSource ?? "request",
    },
  });

  const evidence = await searchEvidence({
    query: [extraction.english_query, ...extraction.keywords].join(" "),
    country: location.country,
    regionLabel: location.regionName ?? extraction.location_hints[0],
    limit: 8,
  });
  const newest = await corpusNewest(location.country);
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
    country: location.country,
    regionCode: location.regionCode,
    locationLabel: location.regionName ?? location.country,
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
    country: location.country ?? null,
    regionCode: location.regionCode ?? null,
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
      country: location.country,
      regionCode: location.regionCode,
      claimType: extraction.claim_type,
      clusterKey: clusterKeyFor(extraction, location.country),
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
    location,
    versions: await loadVersions(answerId),
  };
}
