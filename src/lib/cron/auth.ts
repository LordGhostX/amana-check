import { createHash, timingSafeEqual } from "node:crypto";
import { optionalEnv } from "@/lib/env";

const TEMPLATE_CRON_SECRET = "replace-me";

function constantTimeEqual(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

export function isCronAuthorized(headers: Headers): boolean {
  const secret = optionalEnv("CRON_SECRET")?.trim();
  if (!secret) return false;

  if (
    process.env.NODE_ENV === "production" &&
    secret === TEMPLATE_CRON_SECRET
  ) {
    console.error(
      "CRON_SECRET is still the template value, so cron ingestion is disabled in production.",
    );
    return false;
  }

  const authorization = headers.get("authorization");
  return authorization
    ? constantTimeEqual(authorization, `Bearer ${secret}`)
    : false;
}
