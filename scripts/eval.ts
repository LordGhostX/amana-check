import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db, pgClient } from "@/lib/db";
import { answerClaim, type AskResult } from "@/lib/pipeline/answer";

interface EvalExpectation {
  claim_type?: string;
  lang?: string;
  require_evidence?: boolean;
  not_status?: string[];
}

interface EvalClaim {
  id: string;
  text: string;
  expect?: EvalExpectation;
}

interface EvalFile {
  country: string;
  claims: EvalClaim[];
}

interface ClaimResult {
  id: string;
  status: string;
  claimType: string;
  lang: string;
  evidenceCount: number;
  citationBullets: number;
  failures: string[];
}

async function totalCostUsd(): Promise<number> {
  const rows = await db.execute(
    sql`SELECT coalesce(sum(cost_usd), 0)::float AS total FROM llm_calls`,
  );
  return Number((rows as unknown as { total: number }[])[0]?.total ?? 0);
}

function citationBullets(result: AskResult): number {
  return result.payload.whatWeKnow.filter((bullet) => /\[S\d+\]/.test(bullet))
    .length;
}

function evaluate(claim: EvalClaim, result: AskResult): string[] {
  const failures: string[] = [];
  const expect = claim.expect;
  if (!expect) return failures;

  if (expect.claim_type && result.extraction.claim_type !== expect.claim_type) {
    failures.push(
      `claim_type expected ${expect.claim_type}, got ${result.extraction.claim_type}`,
    );
  }
  if (expect.lang && result.extraction.detected_lang !== expect.lang) {
    failures.push(
      `lang expected ${expect.lang}, got ${result.extraction.detected_lang}`,
    );
  }
  if (expect.require_evidence && result.evidence.length === 0) {
    failures.push("expected evidence but none was retrieved");
  }
  if (
    expect.not_status &&
    expect.not_status.includes(result.assessment.status)
  ) {
    failures.push(`status must not be ${result.assessment.status}`);
  }
  if (
    (result.assessment.status === "verified" ||
      result.assessment.status === "developing") &&
    result.evidence.length > 0 &&
    citationBullets(result) === 0
  ) {
    failures.push("verified/developing answer has no cited bullet");
  }
  return failures;
}

async function runFile(file: EvalFile): Promise<ClaimResult[]> {
  const results: ClaimResult[] = [];
  for (const claim of file.claims) {
    try {
      const result = await answerClaim({
        text: claim.text,
        country: file.country,
        bypassCache: true,
      });
      const failures = evaluate(claim, result);
      results.push({
        id: claim.id,
        status: result.assessment.status,
        claimType: result.extraction.claim_type,
        lang: result.extraction.detected_lang,
        evidenceCount: result.evidence.length,
        citationBullets: citationBullets(result),
        failures,
      });
      console.log(
        `${failures.length === 0 ? "PASS" : "FAIL"} ${claim.id} — ${result.assessment.status}, ${result.extraction.claim_type}, ${result.extraction.detected_lang}, evidence ${result.evidence.length}${failures.length ? ` — ${failures.join("; ")}` : ""}`,
      );
    } catch (error) {
      results.push({
        id: claim.id,
        status: "error",
        claimType: "error",
        lang: "error",
        evidenceCount: 0,
        citationBullets: 0,
        failures: [String(error)],
      });
      console.log(`FAIL ${claim.id} — error: ${String(error)}`);
    }
  }
  return results;
}

function summarize(file: EvalFile, results: ClaimResult[]) {
  const withExpectation = file.claims.filter((claim) => claim.expect);
  const typeChecked = withExpectation.filter(
    (claim) => claim.expect?.claim_type,
  ).length;
  const langChecked = withExpectation.filter(
    (claim) => claim.expect?.lang,
  ).length;
  const typePassed = results.filter((result, index) => {
    const expect = file.claims[index]?.expect;
    return (
      expect?.claim_type !== undefined &&
      !result.failures.some((failure) =>
        failure.startsWith("claim_type expected"),
      )
    );
  }).length;
  const langPassed = results.filter((result, index) => {
    const expect = file.claims[index]?.expect;
    return (
      expect?.lang !== undefined &&
      !result.failures.some((failure) => failure.startsWith("lang expected"))
    );
  }).length;
  const withEvidenceExpectation = file.claims.filter(
    (claim) => claim.expect?.require_evidence,
  ).length;
  const evidencePassed = results.filter((result, index) => {
    const expect = file.claims[index]?.expect;
    return (
      expect?.require_evidence === true &&
      !result.failures.some((failure) =>
        failure.startsWith("expected evidence"),
      )
    );
  }).length;
  const citationEligible = results.filter(
    (result) =>
      (result.status === "verified" || result.status === "developing") &&
      result.evidenceCount > 0,
  );
  const citationPassed = citationEligible.filter(
    (result) => result.citationBullets > 0,
  ).length;

  return {
    country: file.country,
    total: results.length,
    passed: results.filter((result) => result.failures.length === 0).length,
    type_accuracy: typeChecked > 0 ? `${typePassed}/${typeChecked}` : "n/a",
    language_accuracy: langChecked > 0 ? `${langPassed}/${langChecked}` : "n/a",
    evidence_coverage:
      withEvidenceExpectation > 0
        ? `${evidencePassed}/${withEvidenceExpectation}`
        : "n/a",
    citation_coverage:
      citationEligible.length > 0
        ? `${citationPassed}/${citationEligible.length}`
        : "n/a",
    statuses: results.reduce<Record<string, number>>((acc, result) => {
      acc[result.status] = (acc[result.status] ?? 0) + 1;
      return acc;
    }, {}),
    failures: results
      .filter((result) => result.failures.length > 0)
      .map((result) => `${result.id}: ${result.failures.join("; ")}`),
  };
}

async function main() {
  const files: EvalFile[] = ["ng", "ke"].map((slug) => {
    const path = join(process.cwd(), "eval", `claims.${slug}.json`);
    return JSON.parse(readFileSync(path, "utf8")) as EvalFile;
  });

  const costBefore = await totalCostUsd();
  const summaries = [];
  const allResults: Record<string, ClaimResult[]> = {};

  for (const file of files) {
    const results = await runFile(file);
    allResults[file.country] = results;
    summaries.push(summarize(file, results));
  }

  const costAfter = await totalCostUsd();
  const report = {
    ranAt: new Date().toISOString(),
    costUsd: Number((costAfter - costBefore).toFixed(6)),
    summaries,
    results: allResults,
  };

  const outDir = join(process.cwd(), "eval", "results");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "latest.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  console.log("\n=== EVAL SUMMARY ===");
  console.log(JSON.stringify(report.summaries, null, 2));
  console.log(`Total eval cost: $${report.costUsd}`);
}

main()
  .then(() => pgClient.end())
  .catch(async (error) => {
    console.error(error);
    await pgClient.end();
    process.exit(1);
  });
