import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isAdminCookie } from "@/lib/admin/auth";
import { dashboardData } from "@/lib/admin/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clampDays(raw: string | null): number {
  const value = Number(raw ?? "7");
  if (!Number.isFinite(value)) return 7;
  return Math.min(90, Math.max(1, Math.round(value)));
}

export async function GET(request: NextRequest) {
  if (!isAdminCookie(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const days = clampDays(new URL(request.url).searchParams.get("days"));
  const data = await dashboardData(days);
  return NextResponse.json(data);
}
