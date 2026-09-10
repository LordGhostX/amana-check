import { pgClient } from "@/lib/db";
import { extractClaim } from "@/lib/pipeline/extract";
import { corpusNewest } from "@/lib/retrieval/corpus";
import { searchEvidence } from "@/lib/retrieval/search";
import { assessEvidence } from "@/lib/trust/freshness";

const DEFAULT_CLAIM =
  "There is a cholera outbreak in Borno State and the government is hiding it.";

function parseArgs(argv: string[]) {
  const flags = new Set(argv.filter((arg) => arg.startsWith("--")));
  const text = argv
    .filter((arg) => !arg.startsWith("--"))
    .join(" ")
    .trim();
  return {
    text: text || DEFAULT_CLAIM,
    country: flags.has("--ke") ? "KE" : flags.has("--ng") ? "NG" : undefined,
  };
}

async function main() {
  const { text, country } = parseArgs(process.argv.slice(2));

  const extraction = await extractClaim(text);
  console.log("EXTRACTION");
  console.log(JSON.stringify(extraction, null, 2));

  const evidence = await searchEvidence({
    query: [extraction.english_query, ...extraction.keywords].join(" "),
    country,
    regionLabel: extraction.location_hints[0],
    limit: 8,
  });
  console.log(`\nEVIDENCE (${evidence.length} chunks)`);
  for (const item of evidence.slice(0, 5)) {
    console.log(
      `  [T${item.tier}] ${item.publisher} — ${item.title.slice(0, 70)} (score ${item.score.toFixed(3)}, cov ${item.coverage.toFixed(2)})`,
    );
  }

  const newest = await corpusNewest(country);
  const assessment = assessEvidence(
    extraction.claim_type,
    evidence.map((item) => ({
      tier: item.tier,
      publisher: item.publisher,
      publishedAt: item.publishedAt,
      fetchedAt: item.fetchedAt,
    })),
    newest,
  );
  console.log("\nASSESSMENT");
  console.log(JSON.stringify(assessment, null, 2));
}

main()
  .then(() => pgClient.end())
  .catch(async (error) => {
    console.error(error);
    await pgClient.end();
    process.exit(1);
  });
