import { createHmac } from "node:crypto";
import { optionalEnv } from "@/lib/env";

/**
 * IPs are stored only as HMAC-SHA256(secret, ip) — never raw, never logged.
 * Locale hints and rate limits are the only things keyed by this hash, and
 * neither table may ever be joined to `claims`.
 */
export function normalizeIp(raw: string): string {
  let value = raw.trim();
  if (value.startsWith("::ffff:")) value = value.slice("::ffff:".length);
  if (value === "::1") value = "127.0.0.1";
  return value.toLowerCase();
}

export function hashIp(rawIp: string, secret?: string): string {
  const key = secret ?? optionalEnv("IP_HASH_SECRET");
  if (!key) {
    throw new Error("IP_HASH_SECRET is not set — refusing to hash IPs without it");
  }
  return createHmac("sha256", key).update(normalizeIp(rawIp)).digest("hex");
}

export function ipFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip");
}
