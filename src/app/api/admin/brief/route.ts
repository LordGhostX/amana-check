import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isAdminCookie } from "@/lib/admin/auth";
import { DEMAND_DISCLAIMER, briefRows, briefToCsv } from "@/lib/admin/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clampDays(raw: string | null): number {
  const value = Number(raw ?? "30");
  if (!Number.isFinite(value)) return 30;
  return Math.min(365, Math.max(1, Math.round(value)));
}

export async function GET(request: NextRequest) {
  if (!isAdminCookie(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const days = clampDays(url.searchParams.get("days"));
  const format = url.searchParams.get("format") ?? "json";
  const rows = await briefRows(days);
  const generatedAt = new Date().toISOString();

  if (format === "csv") {
    return new NextResponse(briefToCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="amana-demand-brief-${generatedAt.slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({
    generatedAt,
    days,
    disclaimer: DEMAND_DISCLAIMER,
    suppression: "Buckets below three checks are suppressed.",
    rows,
  });
}
