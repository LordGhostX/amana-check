import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { referrals } from "@/lib/db/schema";
import type { ClaimType } from "@/lib/trust/types";

export interface ReferralRecord {
  id: number;
  country: string;
  regionCode: string | null;
  category: string;
  name: string;
  phone: string | null;
  description: string | null;
  url: string | null;
  verifiedAt: Date | null;
}

const CATEGORIES: Record<ClaimType, string[]> = {
  security_incident: ["emergency", "humanitarian"],
  flood_weather: ["emergency", "humanitarian"],
  health_outbreak: ["health", "emergency"],
  payment_service_scam: ["civic"],
  civic_process: ["civic", "legal"],
  reference: ["civic", "legal"],
  other: ["emergency"],
};

export function categoriesForClaimType(claimType: ClaimType): string[] {
  return CATEGORIES[claimType];
}

export async function referralsFor(
  country: string | undefined,
  categories: string[],
  options: { regionCode?: string; limit?: number } = {},
): Promise<ReferralRecord[]> {
  if (categories.length === 0) return [];
  const { regionCode, limit = 3 } = options;
  const conditions = [inArray(referrals.category, categories)];
  if (country) conditions.push(eq(referrals.country, country));
  if (regionCode) {
    const regionCondition = or(
      isNull(referrals.regionCode),
      eq(referrals.regionCode, regionCode),
    );
    if (regionCondition) conditions.push(regionCondition);
  }

  const rows = await db
    .select()
    .from(referrals)
    .where(and(...conditions))
    .orderBy(
      referrals.regionCode,
      sql`${referrals.verifiedAt} DESC NULLS LAST`,
      referrals.id,
    )
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    country: row.country,
    regionCode: row.regionCode,
    category: row.category,
    name: row.name,
    phone: row.phone,
    description: row.description,
    url: row.url,
    verifiedAt: row.verifiedAt,
  }));
}
