import { NextResponse, type NextRequest } from "next/server";
import { geoFromHeaders } from "@/lib/locale/geo";
import { hashIp, ipFromHeaders } from "@/lib/locale/hash";
import { fallbackFromRequest } from "@/lib/locale/precedence";
import { RATE_LIMITS, checkRateLimit } from "@/lib/locale/rate-limit";
import { budgetExceeded } from "@/lib/llm/budget";
import { answerClaim } from "@/lib/pipeline/answer";
import { askInputSchema } from "@/lib/pipeline/input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIpHash(request: NextRequest): string | null {
  const ip = ipFromHeaders(request.headers);
  if (!ip) return null;
  try {
    return hashIp(ip);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const requestStartedAt = Date.now();
  const ipHash = clientIpHash(request);

  if (ipHash) {
    const limit = await checkRateLimit(ipHash, RATE_LIMITS.ask);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "rate_limited", resetAt: limit.resetAt.toISOString() },
        { status: 429 },
      );
    }
  }

  const body = await request.json().catch(() => null);
  const parsed = askInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  if (await budgetExceeded()) {
    return NextResponse.json(
      {
        error: "budget_exhausted",
        message:
          "Amana has reached its daily check budget. Please try again tomorrow.",
      },
      { status: 503 },
    );
  }

  const geo = geoFromHeaders(request.headers);
  const fallback = fallbackFromRequest({
    requestedCountry: parsed.data.country,
    requestedRegionCode: parsed.data.regionCode,
    cookieRegionCode: request.cookies.get("amana_region")?.value,
    geoCountry: geo.country,
    geoRegionCode: geo.regionCode,
  });

  try {
    const result = await answerClaim({
      text: parsed.data.text,
      fallbackCountry: fallback.country,
      fallbackRegionCode: fallback.regionCode,
      fallbackSource: fallback.source,
    });
    const totalMs = Date.now() - requestStartedAt;
    const timing = {
      totalMs,
      pipelineMs: result.timing.totalMs,
      stages: result.timing.stages,
    };

    const response = NextResponse.json({
      answerId: result.answerId,
      claimHash: result.claimHash,
      version: result.version,
      cached: result.cached,
      payload: result.payload,
      location: result.location,
      extraction: {
        detectedLang: result.extraction.detected_lang,
        languageConfidence: result.extraction.language_confidence,
        claimType: result.extraction.claim_type,
        sensitivity: result.extraction.sensitivity,
        locationHints: result.extraction.location_hints,
      },
      versions: result.versions,
      timing,
    });
    const stage = timing.stages;
    response.headers.set(
      "Server-Timing",
      [
        `total;dur=${timing.totalMs}`,
        `pipeline;dur=${timing.pipelineMs}`,
        `extract;dur=${stage.extractionMs}`,
        `cache;dur=${stage.cacheLookupMs}`,
        `location;dur=${stage.locationMs}`,
        `evidence;dur=${stage.evidenceSearchMs}`,
        `freshness;dur=${stage.corpusFreshnessMs}`,
        `referrals;dur=${stage.referralsMs}`,
        `synthesis;dur=${stage.synthesisMs}`,
        `persistence;dur=${stage.persistenceMs}`,
      ].join(", "),
    );

    const cookieOptions = {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax" as const,
    };
    if (result.location.regionCode) {
      response.cookies.set(
        "amana_region",
        result.location.regionCode,
        cookieOptions,
      );
    }

    return response;
  } catch (error) {
    console.error("ask failed", error);
    return NextResponse.json(
      {
        error: "answer_failed",
        message: "Amana could not complete this check. Please try again.",
      },
      { status: 500 },
    );
  }
}
