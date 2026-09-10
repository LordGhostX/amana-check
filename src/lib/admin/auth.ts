import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { requireEnv } from "@/lib/env";

export const ADMIN_COOKIE = "amana_admin";
export const ADMIN_SESSION_TTL_MS = 2 * 60 * 60 * 1000;

const TEMPLATE_PASSCODE = "replace-me";

function signingKey(): string {
  return createHmac("sha256", requireEnv("APP_SECRET"))
    .update("admin-session")
    .digest("hex");
}

/**
 * Hash both inputs before comparing so the comparison is constant time for
 * any input length, including mismatched lengths.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
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
  return constantTimeEqual(signature, expected);
}

export function verifyPasscode(passcode: string): boolean {
  const expected = requireEnv("ADMIN_PASSCODE");
  if (process.env.NODE_ENV === "production" && expected === TEMPLATE_PASSCODE) {
    console.error(
      "ADMIN_PASSCODE is still the template value, so admin login is disabled in production.",
    );
    return false;
  }
  return constantTimeEqual(passcode, expected);
}

export function isAdminCookie(cookieValue: string | undefined): boolean {
  try {
    return verifySessionToken(cookieValue);
  } catch {
    return false;
  }
}

/**
 * Blocks cross-site browser requests. Requests without an Origin header
 * (scripts, curl) pass, because they carry no ambient cookie from another
 * site. Browser POSTs from another origin carry one and are rejected.
 */
export function isSameOriginRequest(request: { headers: Headers }): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
