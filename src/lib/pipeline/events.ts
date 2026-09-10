import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import type { AnswerStatus, ClaimType } from "@/lib/trust/types";
import type { Extraction } from "./schemas";

function slug(value: string, fallback: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return normalized || fallback;
}

export function clusterKeyFor(
  extraction: Extraction,
  country?: string,
): string {
  const place = slug(
    extraction.location_hints[0] ?? country ?? "national",
    "national",
  );
  const topic = slug(
    extraction.keywords[0] ?? extraction.claim_type,
    "general",
  );
  return `${place}:${topic}`;
}

export interface VerificationDemandParams {
  country?: string;
  regionCode?: string;
  claimType: ClaimType;
  clusterKey: string;
  status: AnswerStatus;
}

/**
 * Aggregate-only verification demand. No identity, no free text, no exact
 * location. Dashboard queries must apply k>=3 suppression at read time.
 */
export async function recordVerificationDemand(
  params: VerificationDemandParams,
): Promise<void> {
  const bucketDate = new Date().toISOString().slice(0, 10);
  const country = params.country ?? "XX";
  const region = params.regionCode ?? "national";

  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(events)
      .where(
        and(
          eq(events.bucketDate, bucketDate),
          eq(events.country, country),
          eq(events.region, region),
          eq(events.topic, params.claimType),
          eq(events.claimCluster, params.clusterKey),
        ),
      )
      .limit(1);
    const existing = rows[0];

    if (!existing) {
      await tx.insert(events).values({
        bucketDate,
        country,
        region,
        topic: params.claimType,
        claimCluster: params.clusterKey,
        count: 1,
        statusDistribution: { [params.status]: 1 },
      });
      return;
    }

    const distribution = { ...existing.statusDistribution };
    distribution[params.status] = (distribution[params.status] ?? 0) + 1;
    await tx
      .update(events)
      .set({ count: existing.count + 1, statusDistribution: distribution })
      .where(eq(events.id, existing.id));
  });
}
