import assert from "node:assert/strict";
import { test } from "node:test";
import { getEvidenceReferences } from "../src/lib/trust/references";
import type { AnswerPayload, EvidenceItem } from "../src/lib/trust/types";

function evidence(
  documentId: string,
  title: string,
  chunkId: number,
): EvidenceItem {
  return {
    documentId,
    chunkId,
    title,
    publisher: "Publisher",
    url: `https://example.com/${documentId}`,
    tier: 1,
    publishedAt: "2026-09-10T12:00:00.000Z",
    fetchedAt: "2026-09-10T13:00:00.000Z",
  };
}

function payload(overrides: Partial<AnswerPayload>): AnswerPayload {
  return {
    claim: "Example claim",
    answerLang: "en",
    status: "developing",
    statusReason: "More evidence is needed.",
    whatWeKnow: [],
    whatWeDontKnow: [],
    evidence: [],
    nextSteps: [],
    location: null,
    machineTranslated: false,
    checkedAt: "2026-09-10T14:00:00.000Z",
    ...overrides,
  };
}

test("keeps referenced documents once and renumbers citations", () => {
  const references = getEvidenceReferences(
    payload({
      whatWeKnow: ["Second document [S2]", "Another chunk [S3]"],
      whatWeDontKnow: ["First document [S1]", "Second again [S2]"],
      evidence: [
        evidence("first", "First", 1),
        evidence("second", "Second", 2),
        evidence("second", "Second", 3),
        evidence("unused", "Unused", 4),
      ],
    }),
  );

  assert.deepEqual(
    references.items.map(({ item, number }) => [item.documentId, number]),
    [
      ["second", 1],
      ["first", 2],
    ],
  );
  assert.deepEqual(Object.fromEntries(references.numberByCitation), {
    1: 2,
    2: 1,
    3: 1,
  });
});

test("returns no sources when the answer references none", () => {
  const references = getEvidenceReferences(
    payload({ evidence: [evidence("unused", "Unused", 1)] }),
  );

  assert.deepEqual(references.items, []);
  assert.equal(references.numberByCitation.size, 0);
});
