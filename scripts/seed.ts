import { sql } from "drizzle-orm";
import { db, pgClient } from "@/lib/db";
import { referrals, regions, sources } from "@/lib/db/schema";
import {
  loadReferralFile,
  loadRegionFile,
  loadSourceFile,
  type CountrySlug,
} from "@/lib/registry/load";

const SLUGS: CountrySlug[] = ["nigeria", "kenya"];

async function main() {
  let regionTotal = 0;
  let sourceTotal = 0;
  let referralTotal = 0;

  await db.delete(referrals);

  for (const slug of SLUGS) {
    const regionFile = loadRegionFile(slug);
    const regionRows = regionFile.regions.map((region) => ({
      country: regionFile.country,
      level: region.level,
      code: region.code,
      name: region.name,
      parentCode: region.parentCode,
    }));
    await db
      .insert(regions)
      .values(regionRows)
      .onConflictDoUpdate({
        target: regions.code,
        set: {
          country: sql`excluded.country`,
          level: sql`excluded.level`,
          name: sql`excluded.name`,
          parentCode: sql`excluded.parent_code`,
        },
      });
    regionTotal += regionRows.length;

    const sourceFile = loadSourceFile(slug);
    const sourceRows = sourceFile.sources.map((source) => ({
      id: source.id,
      publisher: source.publisher,
      type: source.type,
      tier: source.tier,
      country: sourceFile.country,
      scope: source.scope,
      fetchKind: source.fetch.kind,
      url: source.fetch.url,
      license: source.license ?? null,
      refreshInterval: source.refresh_interval ?? null,
      includeKeywords: source.include_keywords ?? [],
      enabled: source.enabled,
    }));
    await db
      .insert(sources)
      .values(sourceRows)
      .onConflictDoUpdate({
        target: sources.id,
        set: {
          publisher: sql`excluded.publisher`,
          type: sql`excluded.type`,
          tier: sql`excluded.tier`,
          country: sql`excluded.country`,
          scope: sql`excluded.scope`,
          fetchKind: sql`excluded.fetch_kind`,
          url: sql`excluded.url`,
          license: sql`excluded.license`,
          refreshInterval: sql`excluded.refresh_interval`,
          includeKeywords: sql`excluded.include_keywords`,
          enabled: sql`excluded.enabled`,
        },
      });
    sourceTotal += sourceRows.length;

    const referralFile = loadReferralFile(slug);
    const referralRows = referralFile.referrals.map((referral) => ({
      country: referral.country,
      regionCode: referral.regionCode ?? null,
      category: referral.category,
      name: referral.name,
      phone: referral.phone,
      description: referral.description ?? null,
      url: referral.url ?? null,
      verifiedAt: referral.verifiedAt ? new Date(referral.verifiedAt) : null,
    }));
    if (referralRows.length > 0) {
      await db.insert(referrals).values(referralRows);
    }
    referralTotal += referralRows.length;

    console.log(
      `${regionFile.name}: ${regionRows.length} regions, ${sourceRows.length} sources, ${referralRows.length} referrals`,
    );
  }

  console.log(
    `Seeded ${regionTotal} regions, ${sourceTotal} sources, and ${referralTotal} referrals.`,
  );
}

main()
  .then(() => pgClient.end())
  .catch(async (error) => {
    console.error(error);
    await pgClient.end();
    process.exit(1);
  });
