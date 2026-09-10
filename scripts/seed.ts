import { notInArray, sql } from "drizzle-orm";
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
  const seededSlugs: string[] = [];
  const seededSourceIds: string[] = [];

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
      fetchConfig: {
        ...(source.fetch.list_selector
          ? { listSelector: source.fetch.list_selector }
          : {}),
        ...(source.fetch.link_pattern
          ? { linkPattern: source.fetch.link_pattern }
          : {}),
        ...(source.fetch.content_selector
          ? { contentSelector: source.fetch.content_selector }
          : {}),
        ...(source.fetch.title_selector
          ? { titleSelector: source.fetch.title_selector }
          : {}),
        ...(source.fetch.date_selector
          ? { dateSelector: source.fetch.date_selector }
          : {}),
        ...(source.fetch.max_items ? { maxItems: source.fetch.max_items } : {}),
        ...(source.fetch.timeout_ms
          ? { timeoutMs: source.fetch.timeout_ms }
          : {}),
      },
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
          fetchConfig: sql`excluded.fetch_config`,
          license: sql`excluded.license`,
          refreshInterval: sql`excluded.refresh_interval`,
          includeKeywords: sql`excluded.include_keywords`,
          enabled: sql`excluded.enabled`,
        },
      });
    sourceTotal += sourceRows.length;
    seededSourceIds.push(...sourceRows.map((row) => row.id));

    const referralFile = loadReferralFile(slug);
    const referralRows = referralFile.referrals.map((referral) => ({
      slug: referral.slug,
      country: referralFile.country,
      regionCode: referral.regionCode ?? null,
      category: referral.category,
      name: referral.name,
      phone: referral.phone,
      description: referral.description ?? null,
      url: referral.url ?? null,
      verifiedAt: referral.verifiedAt ? new Date(referral.verifiedAt) : null,
    }));
    if (referralRows.length > 0) {
      await db
        .insert(referrals)
        .values(referralRows)
        .onConflictDoUpdate({
          target: referrals.slug,
          set: {
            country: sql`excluded.country`,
            regionCode: sql`excluded.region_code`,
            category: sql`excluded.category`,
            name: sql`excluded.name`,
            phone: sql`excluded.phone`,
            description: sql`excluded.description`,
            url: sql`excluded.url`,
            verifiedAt: sql`excluded.verified_at`,
          },
        });
      seededSlugs.push(...referralRows.map((row) => row.slug));
    }
    referralTotal += referralRows.length;

    console.log(
      `${regionFile.name}: ${regionRows.length} regions, ${sourceRows.length} sources, ${referralRows.length} referrals`,
    );
  }

  if (seededSlugs.length > 0) {
    const pruned = await db
      .delete(referrals)
      .where(notInArray(referrals.slug, seededSlugs))
      .returning({ slug: referrals.slug });
    if (pruned.length > 0) {
      console.log(`Pruned ${pruned.length} referral(s) not in the seed files.`);
    }
  }

  if (seededSourceIds.length > 0) {
    const prunedSources = await db
      .delete(sources)
      .where(notInArray(sources.id, seededSourceIds))
      .returning({ id: sources.id });
    if (prunedSources.length > 0) {
      console.log(
        `Pruned ${prunedSources.length} source(s) no longer in the registries (documents cascade).`,
      );
    }
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
