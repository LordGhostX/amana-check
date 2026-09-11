import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { answerVersions, answers, claims } from "@/lib/db/schema";
import { PROMPT_VERSIONS } from "@/lib/llm/prompts";
import {
  resolveLocation,
  type LocationSource,
  type ResolvedLocation,
} from "@/lib/locale/precedence";
import {
  corpusNewest,
  corpusRevision,
  corpusScopeFor,
} from "@/lib/retrieval/corpus";
import { searchEvidence, type RetrievedChunk } from "@/lib/retrieval/search";
import { categoriesForClaimType, referralsFor } from "@/lib/referrals/lookup";
import {
  assessEvidence,
  capForUnmatchedLocation,
  type EvidenceAssessment,
} from "@/lib/trust/freshness";
import type { AnswerPayload, AnswerStatus, ClaimType } from "@/lib/trust/types";
import { clusterKeyFor, recordVerificationDemand } from "./events";
import { extractClaim, fallbackExtraction } from "./extract";
import {
  cacheTtlMs,
  canUseCachedAnswer,
  claimHashFor,
  isCacheFresh,
} from "./cache";
import type { Extraction } from "./schemas";
import { synthesizeAnswer } from "./synthesize";

export interface AskOptions {
  text: string;
  fallbackCountry?: string;
  fallbackRegionCode?: string;
  fallbackSource?: LocationSource;
  bypassCache?: boolean;
  recordDemand?: boolean;
}

export interface AnswerVersionInfo {
  version: number;
  status: AnswerStatus;
  changedAt: string;
  changeReason: string | null;
}

export interface AnswerTimings {
  totalMs: number;
  stages: {
    extractionMs: number;
    cacheLookupMs: number;
    locationMs: number;
    evidenceSearchMs: number;
    corpusFreshnessMs: number;
    referralsMs: number;
    synthesisMs: number;
    persistenceMs: number;
  };
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
  timing: AnswerTimings;
}

async function timed<T>(work: () => Promise<T>): Promise<[T, number]> {
  const startedAt = Date.now();
  const value = await work();
  return [value, Date.now() - startedAt];
}

async function loadCachedExtraction(
  claimId: number,
  text: string,
  answerLang: string,
  claimType: ClaimType,
): Promise<{ extraction: Extraction; usedFallback: boolean }> {
  const rows = await db
    .select({
      claimText: claims.claimText,
      englishQuery: claims.englishQuery,
      keywords: claims.keywords,
      locationHints: claims.locationHints,
      detectedLang: claims.detectedLang,
      languageConfidence: claims.languageConfidence,
      claimType: claims.claimType,
      sensitivity: claims.sensitivity,
    })
    .from(claims)
    .where(eq(claims.id, claimId))
    .limit(1);
  const stored = rows[0];
  const fallback = fallbackExtraction(text);
  if (!stored) {
    return {
      extraction: {
        ...fallback,
        detected_lang: answerLang,
        claim_type: claimType,
      },
      usedFallback: true,
    };
  }

  return {
    extraction: {
      detected_lang: stored.detectedLang ?? answerLang,
      language_confidence: stored.languageConfidence ?? 0,
      claim_text: stored.claimText,
      claim_type: stored.claimType ?? claimType,
      sensitivity: stored.sensitivity ?? fallback.sensitivity,
      english_query: stored.englishQuery ?? fallback.english_query,
      keywords:
        stored.keywords && stored.keywords.length > 0
          ? stored.keywords
          : fallback.keywords,
      location_hints: stored.locationHints ?? [],
    },
    usedFallback: stored.languageConfidence === null,
  };
}

async function recordDemandSafely(
  extraction: Extraction,
  country: string | undefined,
  regionCode: string | undefined,
  claimType: ClaimType,
  status: AnswerStatus,
): Promise<void> {
  try {
    await recordVerificationDemand({
      country,
      regionCode,
      claimType,
      clusterKey: clusterKeyFor(extraction, country),
      status,
    });
  } catch {
    // Demand aggregation must never break answering.
  }
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

function cachedAssessment(
  payload: AnswerPayload,
  claimType: ClaimType,
): EvidenceAssessment {
  return {
    status: payload.status,
    reason: payload.statusReason,
    windowMs: cacheTtlMs(claimType),
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

interface StableEvidenceResult {
  evidence: RetrievedChunk[];
  newest: Date | null;
  corpusRevision: number;
  evidenceSearchMs: number;
  corpusFreshnessMs: number;
}

const MAX_CORPUS_RETRIEVAL_ATTEMPTS = 3;

async function retrieveStableEvidence(input: {
  query: string;
  country?: string;
  regionLabel?: string;
}): Promise<StableEvidenceResult> {
  let latest: StableEvidenceResult | null = null;
  let evidenceSearchMs = 0;
  let corpusFreshnessMs = 0;
  let fallbackRevision = 0;

  for (let attempt = 0; attempt < MAX_CORPUS_RETRIEVAL_ATTEMPTS; attempt += 1) {
    const revisionBeforeStartedAt = Date.now();
    const revisionBefore = await corpusRevision(input.country);
    fallbackRevision = revisionBefore;
    const revisionBeforeMs = Date.now() - revisionBeforeStartedAt;
    const [evidenceResult, newestResult] = await Promise.all([
      timed(() =>
        searchEvidence({
          query: input.query,
          country: input.country,
          regionLabel: input.regionLabel,
          limit: 8,
        }),
      ),
      timed(() => corpusNewest(input.country)),
    ]);
    const revisionAfterStartedAt = Date.now();
    const revisionAfter = await corpusRevision(input.country);
    const revisionAfterMs = Date.now() - revisionAfterStartedAt;
    const [evidence, evidenceMs] = evidenceResult;
    const [newest, newestMs] = newestResult;
    evidenceSearchMs += evidenceMs;
    corpusFreshnessMs += revisionBeforeMs + newestMs + revisionAfterMs;
    latest = {
      evidence,
      newest,
      corpusRevision: revisionAfter,
      evidenceSearchMs,
      corpusFreshnessMs,
    };

    if (revisionBefore === revisionAfter) return latest;
  }

  if (!latest) throw new Error("evidence retrieval did not produce a result");
  return {
    ...latest,
    corpusRevision: fallbackRevision,
  };
}

export async function answerClaim(options: AskOptions): Promise<AskResult> {
  const pipelineStartedAt = Date.now();
  const timing: AnswerTimings = {
    totalMs: 0,
    stages: {
      extractionMs: 0,
      cacheLookupMs: 0,
      locationMs: 0,
      evidenceSearchMs: 0,
      corpusFreshnessMs: 0,
      referralsMs: 0,
      synthesisMs: 0,
      persistenceMs: 0,
    },
  };

  const claimHash = claimHashFor(
    options.text,
    options.fallbackCountry,
    options.fallbackRegionCode,
  );

  if (!options.bypassCache) {
    const [cacheResult, cacheLookupMs] = await timed(async () => {
      const cachedRows = await db
        .select()
        .from(answers)
        .where(eq(answers.claimHash, claimHash))
        .orderBy(desc(answers.updatedAt))
        .limit(1);
      const cached = cachedRows[0];
      return {
        cached,
        currentCorpusRevision: cached
          ? await corpusRevision(cached.corpusScope)
          : null,
      };
    });
    timing.stages.cacheLookupMs = cacheLookupMs;
    const cached = cacheResult.cached;
    if (cached) {
      const cachedExtraction = await loadCachedExtraction(
        cached.claimId,
        options.text,
        cached.lang,
        cached.claimType,
      );
      if (
        isCacheFresh({
          claimType: cached.claimType,
          cacheGeneratedAt: cached.cacheGeneratedAt,
          evidence: cached.payload.evidence,
          storedCorpusRevision: cached.corpusRevision,
          currentCorpusRevision: cacheResult.currentCorpusRevision ?? 0,
        }) &&
        canUseCachedAnswer(cached.reviewState, cachedExtraction.usedFallback)
      ) {
        const persistenceStartedAt = Date.now();
        const versions = await loadVersions(cached.id);
        if (options.recordDemand !== false) {
          await recordDemandSafely(
            cachedExtraction.extraction,
            cached.payload.location?.country,
            cached.payload.location?.regionCode,
            cached.claimType,
            cached.payload.status,
          );
        }
        timing.stages.persistenceMs = Date.now() - persistenceStartedAt;
        timing.totalMs = Date.now() - pipelineStartedAt;
        return {
          answerId: cached.id,
          claimHash,
          version: cached.version,
          cached: true,
          payload: cached.payload,
          extraction: cachedExtraction.extraction,
          evidence: [],
          assessment: cachedAssessment(cached.payload, cached.claimType),
          location: cachedLocation(cached.payload),
          versions,
          timing,
        };
      }
    }
  }

  const [extractionResult, extractionMs] = await timed(() =>
    extractClaim(options.text),
  );
  timing.stages.extractionMs = extractionMs;
  const { extraction, usedFallback: extractionUsedFallback } = extractionResult;
  const lang = extraction.detected_lang;

  const [location, locationMs] = await timed(() =>
    resolveLocation({
      claimLocationHints: extraction.location_hints,
      fallback: {
        country: options.fallbackCountry,
        regionCode: options.fallbackRegionCode,
        source: options.fallbackSource ?? "request",
      },
    }),
  );
  timing.stages.locationMs = locationMs;
  const corpusScope = corpusScopeFor(location.country);

  const [evidenceResult, referralResult] = await Promise.all([
    retrieveStableEvidence({
      query: [extraction.english_query, ...extraction.keywords].join(" "),
      country: location.country,
      regionLabel: location.regionName ?? extraction.location_hints[0],
    }),
    timed(() =>
      referralsFor(
        location.country,
        categoriesForClaimType(extraction.claim_type),
        { regionCode: location.regionCode },
      ),
    ),
  ]);
  const {
    evidence,
    newest,
    corpusRevision: corpusRevisionAtCheck,
    evidenceSearchMs,
    corpusFreshnessMs,
  } = evidenceResult;
  const [referralRows, referralsMs] = referralResult;
  timing.stages.evidenceSearchMs = evidenceSearchMs;
  timing.stages.corpusFreshnessMs = corpusFreshnessMs;
  timing.stages.referralsMs = referralsMs;
  const assessment = capForUnmatchedLocation(
    assessEvidence(
      extraction.claim_type,
      evidence.map((item) => ({
        tier: item.tier,
        publisher: item.publisher,
        publishedAt: item.publishedAt,
        fetchedAt: item.fetchedAt,
      })),
      newest,
    ),
    extraction.location_hints,
    evidence.map((item) => ({ title: item.title, content: item.content })),
  );

  const [payload, synthesisMs] = await timed(() =>
    synthesizeAnswer({
      claim: extraction.claim_text,
      extraction,
      assessment,
      evidence,
      referrals: referralRows.map((row) => ({
        name: row.name,
        phone: row.phone ?? "no phone listed",
        description: row.description,
        verified: row.verifiedAt !== null,
      })),
      country: location.country,
      regionCode: location.regionCode,
      locationLabel: location.regionName ?? location.country,
    }),
  );
  timing.stages.synthesisMs = synthesisMs;

  const cacheGeneratedAt = new Date();
  const persistenceStartedAt = Date.now();
  const persisted = await db.transaction(async (tx) => {
    const insertedClaims = await tx
      .insert(claims)
      .values({
        claimHash,
        claimText: extraction.claim_text,
        englishQuery: extraction.english_query,
        keywords: extraction.keywords,
        locationHints: extraction.location_hints,
        detectedLang: lang,
        languageConfidence: extractionUsedFallback
          ? null
          : Math.round(extraction.language_confidence),
        claimType: extraction.claim_type,
        sensitivity: extraction.sensitivity,
        country: location.country ?? null,
        regionCode: location.regionCode ?? null,
        locationText: extraction.location_hints.join(", ") || null,
      })
      .returning({ id: claims.id });
    const claim = insertedClaims[0];
    if (!claim) throw new Error("claim insert did not return an id");

    const upserted = await tx
      .insert(answers)
      .values({
        claimId: claim.id,
        claimHash,
        lang,
        status: payload.status,
        claimType: extraction.claim_type,
        payload,
        promptVersion: PROMPT_VERSIONS.synthesize,
        version: 1,
        cacheGeneratedAt,
        corpusScope,
        corpusRevision: corpusRevisionAtCheck,
      })
      .onConflictDoUpdate({
        target: [answers.claimHash, answers.lang],
        set: {
          claimId: claim.id,
          status: payload.status,
          claimType: extraction.claim_type,
          payload,
          promptVersion: PROMPT_VERSIONS.synthesize,
          version: sql`${answers.version} + 1`,
          cacheGeneratedAt,
          corpusScope,
          corpusRevision: corpusRevisionAtCheck,
          reviewState: "unreviewed",
          reviewNote: null,
          reviewedAt: null,
          reviewer: null,
          updatedAt: new Date(),
        },
      })
      .returning({ id: answers.id, version: answers.version });
    const answer = upserted[0];
    if (!answer) throw new Error("answer upsert did not return a row");

    await tx.insert(answerVersions).values({
      answerId: answer.id,
      version: answer.version,
      status: payload.status,
      payload,
      changeReason: answer.version === 1 ? "initial" : "recheck",
    });

    return { answerId: answer.id, version: answer.version };
  });
  const { answerId, version } = persisted;

  if (options.recordDemand !== false) {
    await recordDemandSafely(
      extraction,
      location.country,
      location.regionCode,
      extraction.claim_type,
      payload.status,
    );
  }

  const versions = await loadVersions(answerId);
  timing.stages.persistenceMs = Date.now() - persistenceStartedAt;
  timing.totalMs = Date.now() - pipelineStartedAt;

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
    versions,
    timing,
  };
}
