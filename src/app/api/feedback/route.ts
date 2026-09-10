import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { feedback } from "@/lib/db/schema";
import { hashIp, ipFromHeaders } from "@/lib/locale/hash";
import { RATE_LIMITS, checkRateLimit } from "@/lib/locale/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  answerId: z.number().int().positive(),
  rating: z.enum(["helpful", "not_helpful", "wrong"]),
});

export async function POST(request: NextRequest) {
  const ip = ipFromHeaders(request.headers);
  if (ip) {
    try {
      const limit = await checkRateLimit(hashIp(ip), RATE_LIMITS.feedback);
      if (!limit.allowed) {
        return NextResponse.json(
          { error: "rate_limited", resetAt: limit.resetAt.toISOString() },
          { status: 429 },
        );
      }
    } catch {
      // Missing secret or DB hiccup must not block feedback.
    }
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    await db.insert(feedback).values({
      answerId: parsed.data.answerId,
      rating: parsed.data.rating,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("feedback failed", error);
    return NextResponse.json({ error: "feedback_failed" }, { status: 500 });
  }
}
