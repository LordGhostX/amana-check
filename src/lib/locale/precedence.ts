import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const SUPPORTED_COUNTRIES = new Set(["NG", "KE"]);

export type LocationSource =
  "claim" | "request" | "cookie" | "geo" | "cache" | "national";

export interface RegionRef {
  code: string;
  name: string;
  country: string;
  level: string;
}

export interface ResolvedLocation {
  country?: string;
  regionCode?: string;
  regionName?: string;
  source: LocationSource;
}

interface RegionRow {
  code: string;
  name: string;
  country: string;
  level: string;
}

const SELECT_REGION = sql`SELECT code, name, country, level FROM regions`;

function firstRow(rows: unknown): RegionRef | null {
  const row = (rows as unknown as RegionRow[])[0];
  if (!row) return null;
  return {
    code: row.code,
    name: row.name,
    country: row.country,
    level: row.level,
  };
}

export async function findRegionByName(
  name: string,
): Promise<RegionRef | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const candidates = [trimmed];
  const stripped = trimmed
    .replace(/\s+(state|county|county council)$/i, "")
    .trim();
  if (stripped && stripped !== trimmed) candidates.push(stripped);

  for (const candidate of candidates) {
    const rows = await db.execute(sql`
      ${SELECT_REGION}
      WHERE name ILIKE ${`%${candidate}%`} OR similarity(name, ${candidate}) > 0.45
      ORDER BY
        CASE WHEN lower(name) = lower(${candidate}) THEN 0 ELSE 1 END,
        similarity(name, ${candidate}) DESC,
        CASE level WHEN 'state' THEN 0 WHEN 'county' THEN 0 ELSE 1 END
      LIMIT 1
    `);
    const region = firstRow(rows);
    if (region) return region;
  }
  return null;
}

export async function findRegionByCode(
  code: string,
): Promise<RegionRef | null> {
  const rows = await db.execute(
    sql`${SELECT_REGION} WHERE code = ${code.toUpperCase()} LIMIT 1`,
  );
  return firstRow(rows);
}

export interface FallbackInput {
  requestedCountry?: string;
  requestedRegionCode?: string;
  cookieRegionCode?: string;
  geoCountry?: string;
  geoRegionCode?: string;
}

/**
 * Precedence below the claim itself:
 * user-selected > cookie > Vercel geo > national.
 */
export function fallbackFromRequest(input: FallbackInput): {
  country?: string;
  regionCode?: string;
  source: LocationSource;
} {
  const requestedCountry = input.requestedCountry?.toUpperCase();
  if (input.requestedRegionCode) {
    return {
      country: requestedCountry,
      regionCode: input.requestedRegionCode.toUpperCase(),
      source: "request",
    };
  }
  if (requestedCountry && SUPPORTED_COUNTRIES.has(requestedCountry)) {
    return { country: requestedCountry, source: "request" };
  }
  if (input.cookieRegionCode) {
    return {
      regionCode: input.cookieRegionCode.toUpperCase(),
      source: "cookie",
    };
  }
  const geoCountry = input.geoCountry?.toUpperCase();
  if (geoCountry && SUPPORTED_COUNTRIES.has(geoCountry)) {
    return {
      country: geoCountry,
      regionCode: input.geoRegionCode?.toUpperCase(),
      source: "geo",
    };
  }
  return { source: "national" };
}

/**
 * Explicit location in the claim wins over every fallback. Geo only ever
 * narrows the corpus; it never decides language.
 */
export async function resolveLocation(input: {
  claimLocationHints: string[];
  fallback?: { country?: string; regionCode?: string; source: LocationSource };
}): Promise<ResolvedLocation> {
  for (const hint of input.claimLocationHints.slice(0, 5)) {
    const region = await findRegionByName(hint);
    if (region) {
      return {
        country: region.country,
        regionCode: region.code,
        regionName: region.name,
        source: "claim",
      };
    }
  }

  const fallback = input.fallback;
  if (fallback?.regionCode) {
    const region = await findRegionByCode(fallback.regionCode);
    if (region) {
      return {
        country: region.country,
        regionCode: region.code,
        regionName: region.name,
        source: fallback.source,
      };
    }
  }
  if (fallback?.country && SUPPORTED_COUNTRIES.has(fallback.country)) {
    return { country: fallback.country, source: fallback.source };
  }
  return { source: "national" };
}
