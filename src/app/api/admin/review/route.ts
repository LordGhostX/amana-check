import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ADMIN_COOKIE, isAdminCookie } from "@/lib/admin/auth";
import { approveAnswer, correctAnswer } from "@/lib/admin/data";
import { optionalEnv } from "@/lib/env";
import { ANSWER_STATUSES } from "@/lib/trust/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    answerId: z.number().int().positive(),
    note: z.string().trim().max(1000).optional(),
  }),
  z.object({
    action: z.literal("correct"),
    answerId: z.number().int().positive(),
    status: z.enum(ANSWER_STATUSES).optional(),
    whatWeKnow: z.array(z.string().trim().max(600)).max(3).optional(),
    whatWeDontKnow: z.array(z.string().trim().max(600)).max(3).optional(),
    note: z.string().trim().max(1000).optional(),
  }),
]);

export async function POST(request: NextRequest) {
  if (!isAdminCookie(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const reviewer = optionalEnv("ADMIN_NAME") ?? "reviewer";

  try {
    const result =
      parsed.data.action === "approve"
        ? await approveAnswer(parsed.data.answerId, reviewer, parsed.data.note)
        : await correctAnswer(parsed.data.answerId, reviewer, {
            status: parsed.data.status,
            whatWeKnow: parsed.data.whatWeKnow,
            whatWeDontKnow: parsed.data.whatWeDontKnow,
            note: parsed.data.note,
          });
    return NextResponse.json({
      ok: true,
      version: result.version,
      status: result.status,
    });
  } catch (error) {
    console.error("review failed", error);
    return NextResponse.json({ error: "review_failed" }, { status: 500 });
  }
}
