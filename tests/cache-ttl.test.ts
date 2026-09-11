import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cacheExpiresAt,
  cacheTtlMs,
  isCacheFresh,
} from "../src/lib/pipeline/cache";
import {
  corpusScopeFor,
  GLOBAL_CORPUS_SCOPE,
} from "../src/lib/retrieval/corpus";
import { HOUR_MS, DAY_MS } from "../src/lib/trust/freshness";

const checkedAt = new Date("2026-09-11T12:00:00.000Z");

test("corpus scopes normalize countries and support national answers", () => {
  assert.equal(corpusScopeFor(" ng "), "NG");
  assert.equal(corpusScopeFor(undefined), GLOBAL_CORPUS_SCOPE);
});

test("cache TTLs follow the claim freshness requirements", () => {
  assert.equal(cacheTtlMs("security_incident"), 4 * HOUR_MS);
  assert.equal(cacheTtlMs("flood_weather"), 12 * HOUR_MS);
  assert.equal(cacheTtlMs("health_outbreak"), DAY_MS);
  assert.equal(cacheTtlMs("payment_service_scam"), 72 * HOUR_MS);
});

test("a cache entry is fresh through its TTL boundary", () => {
  assert.equal(
    isCacheFresh({
      claimType: "security_incident",
      cacheGeneratedAt: checkedAt,
      evidence: [],
      storedCorpusRevision: 4,
      currentCorpusRevision: 4,
      now: new Date(checkedAt.getTime() + 4 * HOUR_MS),
    }),
    true,
  );
  assert.equal(
    isCacheFresh({
      claimType: "security_incident",
      cacheGeneratedAt: checkedAt,
      evidence: [],
      storedCorpusRevision: 4,
      currentCorpusRevision: 4,
      now: new Date(checkedAt.getTime() + 4 * HOUR_MS + 1),
    }),
    false,
  );
});

test("changed corpus revisions expire an otherwise recent answer", () => {
  assert.equal(
    isCacheFresh({
      claimType: "reference",
      cacheGeneratedAt: checkedAt,
      evidence: [],
      storedCorpusRevision: 4,
      currentCorpusRevision: 5,
      now: new Date(checkedAt.getTime() + HOUR_MS),
    }),
    false,
  );
});

test("missing corpus content can become cache-invalid when documents arrive", () => {
  assert.equal(
    isCacheFresh({
      claimType: "other",
      cacheGeneratedAt: checkedAt,
      evidence: [],
      storedCorpusRevision: 0,
      currentCorpusRevision: 1,
      now: new Date(checkedAt.getTime() + HOUR_MS),
    }),
    false,
  );
});

test("evidence freshness can expire a newly registered cache entry", () => {
  const evidence = [
    {
      documentId: "doc-1",
      title: "Security update",
      publisher: "Official source",
      url: "https://example.test/security",
      tier: 1,
      publishedAt: "2026-09-11T08:01:00.000Z",
      fetchedAt: "2026-09-11T11:59:00.000Z",
    },
  ];
  const generatedAt = checkedAt;
  const deadline = cacheExpiresAt({
    claimType: "security_incident",
    cacheGeneratedAt: generatedAt,
    evidence,
  });

  assert.equal(deadline.toISOString(), "2026-09-11T12:01:00.000Z");
  assert.equal(
    isCacheFresh({
      claimType: "security_incident",
      cacheGeneratedAt: generatedAt,
      evidence,
      storedCorpusRevision: 1,
      currentCorpusRevision: 1,
      now: deadline,
    }),
    true,
  );
  assert.equal(
    isCacheFresh({
      claimType: "security_incident",
      cacheGeneratedAt: generatedAt,
      evidence,
      storedCorpusRevision: 1,
      currentCorpusRevision: 1,
      now: new Date(deadline.getTime() + 1),
    }),
    false,
  );
});

test("evidence without a publication date uses its fetch date", () => {
  const evidence = [
    {
      documentId: "doc-2",
      title: "Weather update",
      publisher: "Official source",
      url: "https://example.test/weather",
      tier: 1,
      publishedAt: null,
      fetchedAt: "2026-09-11T00:00:00.000Z",
    },
  ];
  assert.equal(
    cacheExpiresAt({
      claimType: "flood_weather",
      cacheGeneratedAt: checkedAt,
      evidence,
    }).toISOString(),
    "2026-09-11T12:00:00.000Z",
  );
});
