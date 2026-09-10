import { db } from "@/lib/db";
import { llmCalls } from "@/lib/db/schema";
import type { LlmCallLog } from "./client";

/**
 * Best-effort cost/telemetry logging. Never blocks or fails the request path,
 * and never records prompt or completion content.
 */
export async function logLlmCall(entry: LlmCallLog): Promise<void> {
  try {
    await db.insert(llmCalls).values({
      model: entry.model,
      promptVersion: entry.promptVersion,
      stage: entry.stage,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      costUsd: entry.costUsd != null ? entry.costUsd.toString() : null,
      success: entry.success,
      errorType: entry.errorType ?? null,
    });
  } catch {
    // Telemetry must never break answering.
  }
}
