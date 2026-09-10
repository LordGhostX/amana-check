import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { optionalEnv } from "@/lib/env";

export const DEFAULT_DAILY_BUDGET_USD = 5;

export async function dailyCostUsd(): Promise<number> {
  const rows = await db.execute(
    sql`SELECT coalesce(sum(cost_usd), 0)::float AS total FROM llm_calls WHERE created_at >= date_trunc('day', now())`,
  );
  return Number((rows as unknown as { total: number }[])[0]?.total ?? 0);
}

export function dailyBudgetUsd(): number {
  const raw = optionalEnv("DAILY_COST_LIMIT_USD");
  const value = raw ? Number(raw) : DEFAULT_DAILY_BUDGET_USD;
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_DAILY_BUDGET_USD;
}

/**
 * Cost control. Fails open on telemetry errors so a database hiccup cannot
 * lock the service, but closes the doors once the daily budget is reached.
 */
export async function budgetExceeded(): Promise<boolean> {
  try {
    return (await dailyCostUsd()) >= dailyBudgetUsd();
  } catch {
    return false;
  }
}
