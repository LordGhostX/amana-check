import { createHash } from "node:crypto";

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
