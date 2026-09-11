import { pgClient } from "@/lib/db";
import { closeIngestLockClient } from "@/lib/ingest/lock";
import { ingestSources } from "@/lib/ingest/run";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const limitRaw = arg("limit");
  const concurrencyRaw = arg("concurrency");
  const summary = await ingestSources({
    sourceId: arg("source"),
    country: arg("country")?.toUpperCase(),
    limitPerSource: limitRaw ? Number(limitRaw) : undefined,
    sourceConcurrency: concurrencyRaw ? Number(concurrencyRaw) : undefined,
  });
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .then(async () => {
    await closeIngestLockClient();
    await pgClient.end();
  })
  .catch(async (error) => {
    console.error(error);
    await closeIngestLockClient();
    await pgClient.end();
    process.exit(1);
  });
