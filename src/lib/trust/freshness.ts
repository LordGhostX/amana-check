import type { AnswerStatus, ClaimType } from "@/lib/trust/types";

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

export interface Requirement {
  windowMs: number;
  minTier1: number;
  minTier2: number;
}

/**
 * Freshness windows and evidence requirements per claim type. 99 means
 * "never sufficient" for that tier so that e.g. flood warnings require an
 * official primary source.
 */
export const REQUIREMENTS: Record<ClaimType, Requirement> = {
  security_incident: { windowMs: 2 * HOUR_MS, minTier1: 1, minTier2: 2 },
  flood_weather: { windowMs: 6 * HOUR_MS, minTier1: 1, minTier2: 99 },
  health_outbreak: { windowMs: 24 * HOUR_MS, minTier1: 1, minTier2: 2 },
  payment_service_scam: { windowMs: 72 * HOUR_MS, minTier1: 1, minTier2: 1 },
  civic_process: { windowMs: 7 * DAY_MS, minTier1: 1, minTier2: 99 },
  reference: { windowMs: 30 * DAY_MS, minTier1: 1, minTier2: 1 },
  other: { windowMs: 24 * HOUR_MS, minTier1: 1, minTier2: 2 },
};

export interface AssessableEvidence {
  tier: number;
  publisher: string;
  publishedAt: Date | null;
  fetchedAt: Date;
}

export interface EvidenceAssessment {
  status: AnswerStatus;
  reason: string;
  windowMs: number;
  newestEvidenceAt: Date | null;
  stale: boolean;
}

function evidenceTime(evidence: AssessableEvidence): number {
  return (evidence.publishedAt ?? evidence.fetchedAt).getTime();
}

export function assessEvidence(
  claimType: ClaimType,
  evidence: AssessableEvidence[],
  corpusNewestFetchedAt: Date | null,
  now = new Date(),
): EvidenceAssessment {
  const requirement = REQUIREMENTS[claimType];
  const windowMs = requirement.windowMs;
  const newestEvidenceAt =
    evidence.length > 0
      ? new Date(Math.max(...evidence.map(evidenceTime)))
      : null;
  const corpusAgeMs = corpusNewestFetchedAt
    ? now.getTime() - corpusNewestFetchedAt.getTime()
    : null;

  if (evidence.length === 0) {
    if (corpusAgeMs == null) {
      return {
        status: "unknown_coverage",
        reason:
          "No sources are registered or ingested for this area yet, so we cannot check this claim.",
        windowMs,
        newestEvidenceAt: null,
        stale: true,
      };
    }
    if (corpusAgeMs > windowMs) {
      return {
        status: "not_confirmed_stale",
        reason: `Our latest sources for this area are ${describeAge(corpusAgeMs)} old, so we cannot safely judge whether this is current. Do not treat this as confirmation that the situation is safe.`,
        windowMs,
        newestEvidenceAt: null,
        stale: true,
      };
    }
    return {
      status: "unverified",
      reason:
        "No supporting or contradicting source was found in the current corpus. The claim is neither confirmed nor denied.",
      windowMs,
      newestEvidenceAt: null,
      stale: false,
    };
  }

  const ageMs = now.getTime() - (newestEvidenceAt?.getTime() ?? now.getTime());
  if (ageMs > windowMs) {
    return {
      status: "not_confirmed_stale",
      reason: `The most recent evidence we found is ${describeAge(ageMs)} old, which is older than the ${describeAge(windowMs)} freshness window for this kind of claim. Do not treat this as confirmation that the situation is safe.`,
      windowMs,
      newestEvidenceAt,
      stale: true,
    };
  }

  const tier1Count = evidence.filter((item) => item.tier === 1).length;
  const tier2Publishers = new Set(
    evidence.filter((item) => item.tier === 2).map((item) => item.publisher),
  ).size;

  if (
    tier1Count >= requirement.minTier1 ||
    tier2Publishers >= requirement.minTier2
  ) {
    return {
      status: "verified",
      reason:
        "Evidence meets the freshness and source requirements for this claim type.",
      windowMs,
      newestEvidenceAt,
      stale: false,
    };
  }

  return {
    status: "developing",
    reason:
      "Some relevant evidence exists but it does not yet meet the source or independence requirements. Treat it with caution.",
    windowMs,
    newestEvidenceAt,
    stale: false,
  };
}

export function describeAge(ms: number): string {
  if (ms < HOUR_MS) return `${Math.max(1, Math.round(ms / 60_000))} minutes`;
  if (ms < DAY_MS) return `${Math.round(ms / HOUR_MS)} hours`;
  return `${Math.round(ms / DAY_MS)} days`;
}

/**
 * National evidence should not verify a claim about a specific place that no
 * source mentions. When the claim names places and none of the retrieved
 * evidence mentions any of them, a verified verdict stops at developing.
 */
export function capForUnmatchedLocation(
  assessment: EvidenceAssessment,
  locationHints: string[],
  evidence: { title: string; content: string }[],
): EvidenceAssessment {
  if (assessment.status !== "verified" || locationHints.length === 0) {
    return assessment;
  }

  const haystacks = evidence.map((item) =>
    `${item.title}\n${item.content}`.toLowerCase(),
  );
  const matched = locationHints.some((hint) => {
    const needle = hint.trim().toLowerCase();
    return (
      needle.length >= 3 && haystacks.some((text) => text.includes(needle))
    );
  });
  if (matched) return assessment;

  return {
    ...assessment,
    status: "developing",
    reason:
      "The evidence covers the topic but does not mention the place named in the claim, so the verdict stops at developing.",
  };
}
