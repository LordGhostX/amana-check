import { z } from "zod";
import { parseModelChain, requireEnv } from "@/lib/env";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Hardcoded privacy invariants. These are deliberately not configurable:
 * if no endpoint can satisfy them, the call fails closed and the caller
 * must fall back to the deterministic extractive answer path.
 */
const PRIVACY_INVARIANTS = {
  zdr: true,
  data_collection: "deny",
  require_parameters: true,
} as const;

export class NoCompliantProviderError extends Error {
  readonly code = "NO_COMPLIANT_PROVIDER";
  constructor(detail: string) {
    super(`No ZDR-compliant OpenRouter endpoint available: ${detail}`);
    this.name = "NoCompliantProviderError";
  }
}

export class ModelOutputError extends Error {
  readonly code = "MODEL_OUTPUT_INVALID";
  constructor(detail: string) {
    super(`Model output failed validation after retry: ${detail}`);
    this.name = "ModelOutputError";
  }
}

export class LlmRequestError extends Error {
  readonly code = "LLM_REQUEST_FAILED";
  readonly status: number;
  constructor(status: number, detail: string) {
    super(`OpenRouter request failed (${status}): ${detail}`);
    this.name = "LlmRequestError";
    this.status = status;
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmCallLog {
  stage: string;
  model: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
  costUsd?: number;
  success: boolean;
  errorType?: string;
  durationMs: number;
}

export interface StructuredCallOptions {
  stage: string;
  promptVersion: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  onCall?: (log: LlmCallLog) => void | Promise<void>;
}

export interface StructuredCallResult<T> {
  data: T;
  model: string;
  usage: { inputTokens: number; outputTokens: number; costUsd?: number };
}

interface OpenRouterResponse {
  model?: string;
  choices?: {
    message?: {
      content?: string | Array<{ type?: string; text?: string }> | null;
    };
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
}

function isNoCompliantProvider(status: number, body: string): boolean {
  if (status !== 404 && status !== 400 && status !== 403) return false;
  return /no endpoints|data policy|zero data retention|zdr|data_collection/i.test(body);
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  return JSON.parse(candidate);
}

function contentToText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts = content
      .map((part) =>
        part && typeof part === "object" && "text" in part
          ? String((part as { text?: unknown }).text ?? "")
          : "",
      )
      .join("");
    return parts.length > 0 ? parts : null;
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callStructured<T>(
  schema: z.ZodType<T>,
  messages: ChatMessage[],
  options: StructuredCallOptions,
): Promise<StructuredCallResult<T>> {
  const apiKey = requireEnv("OPENROUTER_API_KEY");
  const models = parseModelChain();
  const attempts = 2;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? 45_000,
    );

    let response: Response;
    try {
      response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://amana-check.vercel.app",
          "X-OpenRouter-Title": "Amana Check",
        },
        signal: controller.signal,
        body: JSON.stringify({
          models,
          messages,
          temperature: options.temperature ?? 0.1,
          max_tokens: options.maxTokens ?? 4000,
          response_format: { type: "json_object" },
          provider: { ...PRIVACY_INVARIANTS },
        }),
      });
    } catch (error) {
      clearTimeout(timeout);
      lastError = new LlmRequestError(0, String(error));
      if (attempt < attempts) {
        await sleep(400 * attempt);
        continue;
      }
      await options.onCall?.({
        stage: options.stage,
        model: models[0] ?? "unknown",
        promptVersion: options.promptVersion,
        inputTokens: 0,
        outputTokens: 0,
        success: false,
        errorType: lastError.name,
        durationMs: Date.now() - startedAt,
      });
      throw lastError;
    }
    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      if (isNoCompliantProvider(response.status, body)) {
        const error = new NoCompliantProviderError(body.slice(0, 300));
        await options.onCall?.({
          stage: options.stage,
          model: models[0] ?? "unknown",
          promptVersion: options.promptVersion,
          inputTokens: 0,
          outputTokens: 0,
          success: false,
          errorType: error.code,
          durationMs: Date.now() - startedAt,
        });
        throw error;
      }
      lastError = new LlmRequestError(response.status, body.slice(0, 500));
      if (
        (response.status === 429 || response.status >= 500) &&
        attempt < attempts
      ) {
        await sleep(600 * attempt);
        continue;
      }
      await options.onCall?.({
        stage: options.stage,
        model: models[0] ?? "unknown",
        promptVersion: options.promptVersion,
        inputTokens: 0,
        outputTokens: 0,
        success: false,
        errorType: lastError.name,
        durationMs: Date.now() - startedAt,
      });
      throw lastError;
    }

    const payload = (await response.json()) as OpenRouterResponse;
    const model = payload.model ?? models[0] ?? "unknown";
    const inputTokens = payload.usage?.prompt_tokens ?? 0;
    const outputTokens = payload.usage?.completion_tokens ?? 0;
    const costUsd = payload.usage?.cost;
    const content = contentToText(payload.choices?.[0]?.message?.content ?? null);

    const finish = async (error?: Error): Promise<void> => {
      await options.onCall?.({
        stage: options.stage,
        model,
        promptVersion: options.promptVersion,
        inputTokens,
        outputTokens,
        costUsd,
        success: !error,
        errorType: error?.name,
        durationMs: Date.now() - startedAt,
      });
    };

    if (!content) {
      lastError = new ModelOutputError("empty response content");
      if (attempt < attempts) continue;
      await finish(lastError);
      break;
    }

    let parsed: unknown;
    try {
      parsed = extractJson(content);
    } catch {
      lastError = new ModelOutputError("response was not valid JSON");
      if (attempt < attempts) continue;
      await finish(lastError);
      break;
    }

    const validated = schema.safeParse(parsed);
    if (!validated.success) {
      lastError = new ModelOutputError(
        validated.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
      );
      if (attempt < attempts) continue;
      await finish(lastError);
      break;
    }

    await finish();
    return {
      data: validated.data,
      model,
      usage: { inputTokens, outputTokens, costUsd },
    };
  }

  throw lastError ?? new ModelOutputError("unknown failure");
}

export { PRIVACY_INVARIANTS };
