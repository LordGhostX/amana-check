import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isAdminCookie } from "@/lib/admin/auth";
import { listReviewQueue } from "@/lib/admin/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminCookie(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const includeReviewed =
    new URL(request.url).searchParams.get("includeReviewed") === "1";
  const items = await listReviewQueue({ includeReviewed });
  return NextResponse.json({ items });
}
