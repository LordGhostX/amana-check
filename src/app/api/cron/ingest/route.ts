import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/cron/auth";
import { ingestSources } from "@/lib/ingest/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const schedule = request.headers.get("x-vercel-cron-schedule");
  try {
    const summary = await ingestSources();
    console.log("cron ingest completed", { schedule, summary });
    return NextResponse.json({ ok: true, schedule, summary });
  } catch (error) {
    console.error("cron ingest failed", error);
    return NextResponse.json(
      {
        ok: false,
        schedule,
        error: "ingest_failed",
      },
      { status: 500 },
    );
  }
}
