import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_TTL_MS,
  createSessionToken,
  isSameOriginRequest,
  verifyPasscode,
} from "@/lib/admin/auth";
import { hashIp, ipFromHeaders } from "@/lib/locale/hash";
import { RATE_LIMITS, checkRateLimit } from "@/lib/locale/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ passcode: z.string().min(1).max(200) });

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  const ip = ipFromHeaders(request.headers);
  if (ip) {
    try {
      const limit = await checkRateLimit(hashIp(ip), RATE_LIMITS.adminLogin);
      if (!limit.allowed) {
        return NextResponse.json(
          { error: "rate_limited", resetAt: limit.resetAt.toISOString() },
          { status: 429 },
        );
      }
    } catch {
      // Rate limiting must not prevent a legitimate login attempt.
    }
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let valid = false;
  try {
    valid = verifyPasscode(parsed.data.passcode);
  } catch {
    valid = false;
  }
  if (!valid) {
    return NextResponse.json({ error: "invalid_passcode" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_MS / 1000,
  });
  return response;
}
