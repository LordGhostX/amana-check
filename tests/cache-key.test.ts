import assert from "node:assert/strict";
import { test } from "node:test";
import { canUseCachedAnswer, claimHashFor } from "../src/lib/pipeline/cache";

test("uses normalized user input and location for the cache key", () => {
  const first = claimHashFor("Who is the president?", "ng", "ng-la");
  const sameRequest = claimHashFor(
    "  WHO is the\n president?  ",
    "NG",
    "NG-LA",
  );
  const otherCountry = claimHashFor("Who is the president?", "KE");

  assert.equal(sameRequest, first);
  assert.notEqual(otherCountry, first);
});

test("retries fallback extractions unless a person reviewed the answer", () => {
  assert.equal(canUseCachedAnswer("unreviewed", true), false);
  assert.equal(canUseCachedAnswer("unreviewed", false), true);
  assert.equal(canUseCachedAnswer("approved", true), true);
  assert.equal(canUseCachedAnswer("corrected", true), true);
});
