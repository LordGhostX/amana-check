import assert from "node:assert/strict";
import { test } from "node:test";
import { deduplicateDocuments } from "../src/lib/retrieval/deduplicate";

interface Chunk {
  chunkId: number;
  documentId: string;
}

function chunk(documentId: string, chunkId: number): Chunk {
  return { chunkId, documentId };
}

test("keeps the highest-ranked chunk for each document", () => {
  const unique = deduplicateDocuments([
    chunk("first", 10),
    chunk("first", 11),
    chunk("second", 20),
  ]);

  assert.deepEqual(
    unique.map(({ documentId, chunkId }) => [documentId, chunkId]),
    [
      ["first", 10],
      ["second", 20],
    ],
  );
});

test("leaves room for independent documents before applying the result limit", () => {
  const unique = deduplicateDocuments([
    chunk("first", 10),
    chunk("first", 11),
    chunk("first", 12),
    chunk("second", 20),
    chunk("third", 30),
  ]).slice(0, 3);

  assert.deepEqual(
    unique.map(({ documentId }) => documentId),
    ["first", "second", "third"],
  );
});
