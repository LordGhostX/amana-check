import { pgClient } from "@/lib/db";
import { ingestSources } from "@/lib/ingest/run";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const limitRaw = arg("limit");
  const summary = await ingestSources({
    sourceId: arg("source"),
    country: arg("country")?.toUpperCase(),
    limitPerSource: limitRaw ? Number(limitRaw) : undefined,
  });
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .then(() => pgClient.end())
  .catch(async (error) => {
    console.error(error);
    await pgClient.end();
    process.exit(1);
  });
