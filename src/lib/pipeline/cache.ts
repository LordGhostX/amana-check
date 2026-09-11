import { createHash } from "node:crypto";
import { REQUIREMENTS } from "@/lib/trust/freshness";
import type { ClaimType, EvidenceItem } from "@/lib/trust/types";

export function claimHashFor(
  text: string,
  country?: string,
  regionCode?: string,
): string {
  const normalized = text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha256")
    .update(
      JSON.stringify([
        normalized,
        country?.trim().toUpperCase() ?? "",
        regionCode?.trim().toUpperCase() ?? "",
      ]),
    )
    .digest("hex");
}

export function canUseCachedAnswer(
  reviewState: string,
  extractionUsedFallback: boolean,
): boolean {
  return (
    reviewState === "approved" ||
    reviewState === "corrected" ||
    !extractionUsedFallback
  );
}

export function cacheTtlMs(claimType: ClaimType): number {
  return REQUIREMENTS[claimType].windowMs;
}

function evidenceTimeMs(item: EvidenceItem): number | null {
  const timestamp = Date.parse(item.publishedAt ?? item.fetchedAt);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function cacheExpiresAt(input: {
  claimType: ClaimType;
  cacheGeneratedAt: Date;
  evidence: EvidenceItem[];
}): Date {
  const ttlMs = cacheTtlMs(input.claimType);
  const generatedAtMs = input.cacheGeneratedAt.getTime();
  const evidenceTimes = input.evidence
    .map(evidenceTimeMs)
    .filter((timestamp): timestamp is number => timestamp !== null);
  const newestEvidenceAtMs =
    evidenceTimes.length > 0 ? Math.max(...evidenceTimes) : null;
  const generatedDeadlineMs = generatedAtMs + ttlMs;
  const evidenceDeadlineMs =
    newestEvidenceAtMs === null
      ? generatedDeadlineMs
      : newestEvidenceAtMs + ttlMs;

  return new Date(Math.min(generatedDeadlineMs, evidenceDeadlineMs));
}

export function isCacheFresh(input: {
  claimType: ClaimType;
  cacheGeneratedAt: Date;
  evidence: EvidenceItem[];
  storedCorpusRevision: number;
  currentCorpusRevision: number;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  const generatedAtMs = input.cacheGeneratedAt.getTime();
  if (!Number.isFinite(generatedAtMs) || now.getTime() < generatedAtMs) {
    return false;
  }
  if (now.getTime() > cacheExpiresAt(input).getTime()) return false;
  return input.storedCorpusRevision === input.currentCorpusRevision;
}
