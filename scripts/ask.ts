import { pgClient } from "@/lib/db";
import { answerClaim } from "@/lib/pipeline/answer";

function parseArgs(argv: string[]) {
  const flags = new Set(argv.filter((arg) => arg.startsWith("--")));
  const text = argv
    .filter((arg) => !arg.startsWith("--"))
    .join(" ")
    .trim();
  return {
    text,
    country: flags.has("--ke") ? "KE" : flags.has("--ng") ? "NG" : undefined,
    fresh: flags.has("--fresh"),
  };
}

async function main() {
  const { text, country, fresh } = parseArgs(process.argv.slice(2));
  if (!text) {
    throw new Error('Usage: bun run ask "claim text" [--ng|--ke] [--fresh]');
  }

  const result = await answerClaim({ text, country, bypassCache: fresh });
  console.log(
    JSON.stringify(
      {
        answerId: result.answerId,
        claimHash: result.claimHash.slice(0, 12),
        version: result.version,
        cached: result.cached,
        extraction: {
          lang: result.extraction.detected_lang,
          languageConfidence: result.extraction.language_confidence,
          claimType: result.extraction.claim_type,
          sensitivity: result.extraction.sensitivity,
          locationHints: result.extraction.location_hints,
        },
        assessment: {
          status: result.assessment.status,
          reason: result.assessment.reason,
        },
        evidenceCount: result.evidence.length,
        payload: result.payload,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => pgClient.end())
  .catch(async (error) => {
    console.error(error);
    await pgClient.end();
    process.exit(1);
  });
