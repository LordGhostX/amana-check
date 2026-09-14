import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How Amana Check decides",
  description:
    "Sources, tiers, freshness windows, statuses, and privacy rules behind Amana Check.",
};

const SOURCE_TIERS = [
  [
    "T1",
    "Official primary",
    "Nigeria: NCDC, NEMA, INEC, News Agency of Nigeria, State House Nigeria. Kenya: Kenya News Agency, Office of the President, KEMRI, NEMA, NDMA, KALRO, Ministry of Health, National Police Service, Kenya Met, IEBC",
  ],
  [
    "T2",
    "Independent verification",
    "Nigeria: Dubawa, FactCheckHub, PesaCheck, ReliefWeb, The New Humanitarian. Kenya: ReliefWeb, Kenya Red Cross, PesaCheck, The New Humanitarian",
  ],
  [
    "T3",
    "Credible media",
    "Nigeria: Premium Times, Guardian Nigeria, Daily Trust, The Punch, Nigeria Health Watch. Kenya: The Standard, KBC, Capital FM. These sources support a verdict but never decide one alone",
  ],
];

const STATUSES = [
  [
    "Verified",
    "Evidence meets the freshness and source requirements for that claim type.",
  ],
  [
    "Developing",
    "Relevant evidence exists, but it does not yet meet the independence or source requirements. This also applies when the claim names a place that no source mentions.",
  ],
  [
    "Not verified",
    "The corpus is fresh, but no supporting or contradicting source was found. The claim is neither confirmed nor denied.",
  ],
  [
    "Not confirmed: evidence too old",
    "The most recent relevant evidence is older than the freshness window. This does not mean the situation is safe.",
  ],
  [
    "No coverage yet",
    "No sources are registered or ingested for that area or topic yet.",
  ],
];

const WINDOWS = [
  [
    "Security incident",
    "4 hours",
    "1 official source, or 2 independent T2 sources",
  ],
  ["Flood or weather warning", "12 hours", "1 official source"],
  [
    "Health outbreak",
    "24 hours",
    "1 official source, or 2 independent T2 sources",
  ],
  [
    "Payment or service scam",
    "72 hours",
    "1 official or independent verification source",
  ],
  ["Civic process or deadline", "7 days", "1 official source"],
  [
    "Reference information",
    "30 days",
    "1 official or independent verification source",
  ],
];

export default function MethodologyPage() {
  return (
    <main className="min-w-0 flex-1 overflow-x-clip">
      <section className="page-grid border-b border-line">
        <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-strong"
          >
            <span aria-hidden="true">←</span> Back to checking
          </Link>
          <div className="mt-8 grid min-w-0 gap-6 md:grid-cols-[1fr_0.75fr] md:items-end">
            <div className="min-w-0">
              <p className="font-mono text-xs tracking-[0.16em] text-brand-strong uppercase">
                The methodology
              </p>
              <h1 className="balance mt-3 text-4xl leading-tight font-semibold tracking-tighter text-ink sm:text-6xl">
                How Amana reaches an answer.
              </h1>
            </div>
            <p className="pretty text-base leading-7 text-muted sm:text-lg">
              Amana reports what its sources say and dates every result. When
              the evidence is missing or stale, the answer says so plainly.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-7xl min-w-0 gap-6 px-4 py-10 sm:px-8 sm:py-16 lg:grid-cols-2">
        <section className="min-w-0 rounded-[1.75rem] border border-line bg-surface p-5 sm:p-7">
          <p className="font-mono text-xs text-brand-strong">01 / SOURCES</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-ink">
            Strong sources come first
          </h2>
          <div className="mt-5 flex flex-col gap-3">
            {SOURCE_TIERS.map(([tier, kind, examples]) => (
              <div
                key={tier}
                className="grid gap-2 rounded-2xl bg-surface-muted p-4 sm:grid-cols-[3rem_1fr]"
              >
                <span className="font-mono text-sm font-semibold text-brand-strong">
                  {tier}
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-ink">{kind}</h3>
                  <p className="mt-1 text-sm leading-6 wrap-break-word text-muted">
                    {examples}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="min-w-0 rounded-[1.75rem] border border-line bg-surface p-5 sm:p-7">
          <p className="font-mono text-xs text-brand-strong">02 / FRESHNESS</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-ink">
            Urgent claims expire faster
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            A reference rule can tolerate days. A security incident needs very
            recent evidence.
          </p>
          <div className="mt-5 overflow-hidden rounded-2xl border border-line sm:hidden">
            {WINDOWS.map(([type, window, requirement]) => (
              <div
                key={type}
                className="border-t border-line p-4 first:border-t-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-medium text-ink">{type}</h3>
                  <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 font-mono text-xs text-brand-strong">
                    {window}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-5 text-muted">
                  {requirement}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-5 hidden overflow-hidden rounded-2xl border border-line sm:block">
            <div className="max-w-full overflow-x-auto">
              <table className="w-full min-w-136 border-collapse text-left text-sm">
                <thead className="bg-surface-muted text-xs text-muted uppercase">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Claim</th>
                    <th className="px-4 py-3 font-semibold">Window</th>
                    <th className="px-4 py-3 font-semibold">A verdict needs</th>
                  </tr>
                </thead>
                <tbody>
                  {WINDOWS.map(([type, window, requirement]) => (
                    <tr key={type} className="border-t border-line align-top">
                      <td className="px-4 py-3 font-medium text-ink">{type}</td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap text-brand-strong">
                        {window}
                      </td>
                      <td className="px-4 py-3 leading-5 text-muted">
                        {requirement}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="min-w-0 rounded-[1.75rem] bg-panel p-5 text-white sm:p-7">
          <p className="font-mono text-xs text-accent">03 / VERDICTS</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
            What each result means
          </h2>
          <div className="mt-5 flex flex-col gap-1">
            {STATUSES.map(([status, description]) => (
              <details
                key={status}
                className="group border-b border-white/15 py-3 last:border-0"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-white marker:hidden">
                  {status}
                  <span
                    aria-hidden="true"
                    className="text-accent transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="pt-2 text-sm leading-6 text-white/65">
                  {description}
                </p>
              </details>
            ))}
          </div>
        </section>

        <div className="grid min-w-0 gap-6">
          <section className="rounded-[1.75rem] border border-line bg-surface p-5 sm:p-7">
            <p className="font-mono text-xs text-brand-strong">04 / PRIVACY</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-ink">
              How checks are stored
            </h2>
            <ul className="mt-4 flex flex-col gap-3 text-sm leading-6 text-muted">
              <li>
                Checks are stored without an identity or join key. Raw IP
                addresses are never stored or logged.
              </li>
              <li>
                Model providers must use zero data retention and cannot train on
                requests. If those conditions are unavailable, the request
                fails.
              </li>
              <li>
                Community demand only appears in groups of three or more checks.
                It shows what people are asking, not proof that an incident
                happened.
              </li>
            </ul>
          </section>

          <section className="rounded-[1.75rem] border border-amber-300 bg-amber-50 p-5 sm:p-7 dark:border-amber-900 dark:bg-amber-950/40">
            <p className="font-mono text-xs text-amber-800 dark:text-amber-300">
              05 / LIMITS
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-ink">
              Current limits
            </h2>
            <ul className="mt-4 flex flex-col gap-3 text-sm leading-6 text-muted">
              <li>
                Coverage currently focuses on Nigeria and Kenya, so another
                country may return no coverage.
              </li>
              <li>
                Search runs against a maintained corpus, not the live web, so
                source health and freshness set the limit.
              </li>
              <li>
                Inputs are stored unredacted and unlinked. Leave out names,
                phone numbers, addresses, and other identifying details.
              </li>
            </ul>
          </section>
        </div>

        <div className="lg:col-span-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#095343]"
          >
            Check a message <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
