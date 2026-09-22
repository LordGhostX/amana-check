import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { callStructured } from "../src/lib/llm/client";

const schema = z.object({ ok: z.boolean() });
const messages = [{ role: "user" as const, content: "Return ok." }];

function response(model: string): Response {
  return new Response(
    JSON.stringify({
      model,
      choices: [{ message: { content: '{"ok":true}' } }],
      usage: { prompt_tokens: 3, completion_tokens: 2 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function gatewayZdrPlanError(): Response {
  return new Response(
    JSON.stringify({
      error: {
        message:
          "Zero Data Retention (ZDR) is only available for Pro and Enterprise plans. Current plan: hobby.",
        type: "permission_denied",
      },
    }),
    { status: 403, headers: { "content-type": "application/json" } },
  );
}

test("prefers OpenRouter when both provider keys are configured", async () => {
  const previousOpenRouter = process.env.OPENROUTER_API_KEY;
  const previousGateway = process.env.AI_GATEWAY_API_KEY;
  const previousModels = process.env.OPENROUTER_MODELS;
  const previousFetch = globalThis.fetch;
  let requestUrl = "";
  let requestBody: Record<string, unknown> | undefined;

  process.env.OPENROUTER_API_KEY = "openrouter-test-key";
  process.env.AI_GATEWAY_API_KEY = "gateway-test-key";
  process.env.OPENROUTER_MODELS = "model/primary,model/fallback";
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return response("model/primary");
  };

  try {
    await callStructured(schema, messages, {
      stage: "provider-test",
      promptVersion: "provider-test-v1",
    });
    assert.equal(requestUrl, "https://openrouter.ai/api/v1/chat/completions");
    assert.deepEqual(requestBody?.models, ["model/primary", "model/fallback"]);
    assert.deepEqual(requestBody?.response_format, { type: "json_object" });
    assert.deepEqual(requestBody?.provider, {
      zdr: true,
      data_collection: "deny",
      require_parameters: true,
    });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousOpenRouter === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousOpenRouter;
    if (previousGateway === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousGateway;
    if (previousModels === undefined) delete process.env.OPENROUTER_MODELS;
    else process.env.OPENROUTER_MODELS = previousModels;
  }
});

test("uses AI Gateway when the OpenRouter key is blank", async () => {
  const previousOpenRouter = process.env.OPENROUTER_API_KEY;
  const previousGateway = process.env.AI_GATEWAY_API_KEY;
  const previousModels = process.env.OPENROUTER_MODELS;
  const previousFetch = globalThis.fetch;
  let requestUrl = "";
  let requestBody: Record<string, unknown> | undefined;

  process.env.OPENROUTER_API_KEY = "   ";
  process.env.AI_GATEWAY_API_KEY = "gateway-test-key";
  process.env.OPENROUTER_MODELS = "model/primary,model/fallback";
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return response("model/primary");
  };

  try {
    await callStructured(schema, messages, {
      stage: "provider-test",
      promptVersion: "provider-test-v1",
    });
    assert.equal(
      requestUrl,
      "https://ai-gateway.vercel.sh/v1/chat/completions",
    );
    assert.equal(requestBody?.model, "model/primary");
    assert.deepEqual(requestBody?.response_format, {
      type: "json_schema",
      json_schema: {
        name: "provider-test_response",
        schema: {
          type: "object",
          properties: { ok: { type: "boolean" } },
          required: ["ok"],
          additionalProperties: false,
        },
      },
    });
    assert.deepEqual(requestBody?.providerOptions, {
      gateway: {
        models: ["model/fallback"],
        zeroDataRetention: true,
        disallowPromptTraining: true,
      },
    });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousOpenRouter === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousOpenRouter;
    if (previousGateway === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousGateway;
    if (previousModels === undefined) delete process.env.OPENROUTER_MODELS;
    else process.env.OPENROUTER_MODELS = previousModels;
  }
});

test("retries Gateway without ZDR when the plan rejects it", async () => {
  const previousOpenRouter = process.env.OPENROUTER_API_KEY;
  const previousGateway = process.env.AI_GATEWAY_API_KEY;
  const previousModels = process.env.OPENROUTER_MODELS;
  const previousFetch = globalThis.fetch;
  const requestBodies: Record<string, unknown>[] = [];

  process.env.OPENROUTER_API_KEY = "   ";
  process.env.AI_GATEWAY_API_KEY = "gateway-test-key";
  process.env.OPENROUTER_MODELS = "model/primary,model/fallback";
  globalThis.fetch = async (_input, init) => {
    requestBodies.push(
      JSON.parse(String(init?.body)) as Record<string, unknown>,
    );
    return requestBodies.length === 1
      ? gatewayZdrPlanError()
      : response("model/primary");
  };

  try {
    const result = await callStructured(schema, messages, {
      stage: "provider-test",
      promptVersion: "provider-test-v1",
    });
    assert.deepEqual(result.data, { ok: true });
    assert.equal(requestBodies.length, 2);
    const firstGatewayOptions = (
      requestBodies[0]?.providerOptions as { gateway: Record<string, unknown> }
    ).gateway;
    const secondGatewayOptions = (
      requestBodies[1]?.providerOptions as { gateway: Record<string, unknown> }
    ).gateway;
    assert.equal(firstGatewayOptions.zeroDataRetention, true);
    assert.equal(secondGatewayOptions.zeroDataRetention, undefined);
    assert.equal(secondGatewayOptions.disallowPromptTraining, true);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousOpenRouter === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousOpenRouter;
    if (previousGateway === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousGateway;
    if (previousModels === undefined) delete process.env.OPENROUTER_MODELS;
    else process.env.OPENROUTER_MODELS = previousModels;
  }
});
