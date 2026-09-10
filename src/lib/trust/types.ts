export const ANSWER_STATUSES = [
  "verified",
  "developing",
  "unverified",
  "not_confirmed_stale",
  "unknown_coverage",
] as const;

export type AnswerStatus = (typeof ANSWER_STATUSES)[number];

export const CLAIM_TYPES = [
  "security_incident",
  "flood_weather",
  "health_outbreak",
  "payment_service_scam",
  "civic_process",
  "reference",
  "other",
] as const;

export type ClaimType = (typeof CLAIM_TYPES)[number];

export const SENSITIVITY_LEVELS = ["low", "medium", "high"] as const;

export type Sensitivity = (typeof SENSITIVITY_LEVELS)[number];

export const SOURCE_TYPES = [
  "official",
  "factcheck",
  "humanitarian",
  "media",
  "reference",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export const FETCH_KINDS = ["rss", "html", "pdf", "api"] as const;

export type FetchKind = (typeof FETCH_KINDS)[number];

export interface EvidenceItem {
  documentId: string;
  chunkId?: number;
  title: string;
  publisher: string;
  url: string;
  tier: number;
  publishedAt?: string | null;
  fetchedAt: string;
  excerpt?: string;
  page?: number | null;
  anchor?: string | null;
}

export interface NextStep {
  title: string;
  detail?: string;
  phone?: string;
  url?: string;
}

export interface AnswerLocation {
  country?: string;
  regionCode?: string;
  label?: string;
}

export interface AnswerPayload {
  claim: string;
  answerLang: string;
  status: AnswerStatus;
  statusReason: string;
  whatWeKnow: string[];
  whatWeDontKnow: string[];
  evidence: EvidenceItem[];
  nextSteps: NextStep[];
  location: AnswerLocation | null;
  machineTranslated: boolean;
  checkedAt: string;
}

export interface DocumentSnapshot {
  title: string;
  url: string;
  contentHash: string;
  publishedAt: string | null;
  fetchedAt: string;
  sourceId: string;
}

export interface SourceFetchConfig {
  listSelector?: string;
  linkPattern?: string;
  contentSelector?: string;
  titleSelector?: string;
  dateSelector?: string;
  maxItems?: number;
  timeoutMs?: number;
}
