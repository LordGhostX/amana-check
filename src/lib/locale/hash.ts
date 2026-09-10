import { createHmac } from "node:crypto";
import { optionalEnv } from "@/lib/env";

/**
 * IPs are stored only as HMAC-SHA256(APP_SECRET, ip), never raw and never
 * logged. Rate limits are the only table keyed by this hash, and that table
 * is never joined to `claims`.
 */
export function normalizeIp(raw: string): string {
  let value = raw.trim();
  if (value.startsWith("::ffff:")) value = value.slice("::ffff:".length);
  if (value === "::1") value = "127.0.0.1";
  return value.toLowerCase();
}

export function hashIp(rawIp: string, secret?: string): string {
  const key = secret ?? optionalEnv("APP_SECRET");
  if (!key) {
    throw new Error("APP_SECRET is not set, refusing to hash IPs without it");
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
