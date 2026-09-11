import assert from "node:assert/strict";
import { test } from "node:test";
import { withIngestLock } from "../src/lib/ingest/lock";

test("requires a direct connection before starting ingestion", async () => {
  const previous = process.env.DATABASE_URL_UNPOOLED;
  let workCalled = false;
  delete process.env.DATABASE_URL_UNPOOLED;

  try {
    await assert.rejects(
      withIngestLock(async () => {
        workCalled = true;
        return "unexpected";
      }),
      /DATABASE_URL_UNPOOLED is required for ingestion locking/,
    );
    assert.equal(workCalled, false);
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL_UNPOOLED;
    else process.env.DATABASE_URL_UNPOOLED = previous;
  }
});
