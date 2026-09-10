import { createHmac, timingSafeEqual } from "node:crypto";
import { requireEnv } from "@/lib/env";

export const ADMIN_COOKIE = "amana_admin";
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function signingKey(): string {
  return createHmac("sha256", requireEnv("IP_HASH_SECRET"))
    .update("admin-session")
    .digest("hex");
}

export function createSessionToken(now = Date.now()): string {
  const expires = now + ADMIN_SESSION_TTL_MS;
  const signature = createHmac("sha256", signingKey())
    .update(`admin.${expires}`)
    .digest("hex");
  return `${expires}.${signature}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [expiresRaw, signature] = token.split(".");
  if (!expiresRaw || !signature) return false;
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = createHmac("sha256", signingKey())
    .update(`admin.${expires}`)
    .digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyPasscode(passcode: string): boolean {
  const expected = requireEnv("ADMIN_PASSCODE");
  const a = Buffer.from(passcode);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isAdminCookie(cookieValue: string | undefined): boolean {
  try {
    return verifySessionToken(cookieValue);
  } catch {
    return false;
  }
}
