import assert from "node:assert/strict";
import { test } from "node:test";
import { parseModelChain } from "../src/lib/env";

test("uses the structured-output-compatible DeepSeek fallback chain", () => {
  const previous = process.env.OPENROUTER_MODELS;
  delete process.env.OPENROUTER_MODELS;

  try {
    assert.deepEqual(parseModelChain(), [
      "deepseek/deepseek-v4.1-flash",
      "deepseek/deepseek-v4-flash-0731",
    ]);
  } finally {
    if (previous === undefined) delete process.env.OPENROUTER_MODELS;
    else process.env.OPENROUTER_MODELS = previous;
  }
});
