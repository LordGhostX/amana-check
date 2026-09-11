import assert from "node:assert/strict";
import { test } from "node:test";
import { fallbackExtraction } from "../src/lib/pipeline/extract";
import { fallbackPayload } from "../src/lib/pipeline/synthesize";
import { HOUR_MS } from "../src/lib/trust/freshness";

test("explains an empty corpus without implying a synthesis failure", () => {
  const claim = "A message says the government is giving cash through WhatsApp";
  const payload = fallbackPayload(
    {
      claim,
      extraction: fallbackExtraction(claim),
      assessment: {
        status: "unverified",
        reason:
          "No supporting or contradicting source was found in the current corpus.",
        windowMs: 24 * HOUR_MS,
        newestEvidenceAt: null,
        stale: false,
      },
      evidence: [],
    },
    null,
  );

  assert.deepEqual(payload.whatWeDontKnow, [
    "No source in the current corpus supports or contradicts this claim, so we cannot confirm or deny it.",
  ]);
});
