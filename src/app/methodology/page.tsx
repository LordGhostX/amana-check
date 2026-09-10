import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How Amana Check decides — Amana Check",
  description:
    "Sources, tiers, freshness windows, statuses, and privacy rules behind Amana Check.",
};

const SOURCE_TIERS = [
  [
    "T1",
    "Official primary",
    "NCDC, NEMA, INEC, Nigeria Police, Kenya MOH, NDMA, county and state governments",
  ],
  [
    "T2",
    "Independent verification",
    "Fact-checkers such as Dubawa, FactCheckHub, PesaCheck, Africa Check; humanitarian sources such as UN OCHA ReliefWeb and The New Humanitarian",
  ],
  [
    "T3",
    "Credible media",
    "Established national and regional newsrooms used as supporting evidence, never as a sole basis for a verdict",
  ],
];

const STATUSES = [
  [
    "Verified",
    "Evidence meets the freshness and source requirements for that claim type.",
  ],
  [
    "Developing",
    "Some relevant evidence exists, but it does not yet meet the independence or source requirements.",
  ],
  [
    "Not verified",
    "The corpus is fresh but no supporting or contradicting source was found. This is not confirmation either way.",
  ],
  [
    "Not confirmed — evidence too old",
    "The most recent relevant evidence is older than the freshness window. Amana explicitly warns against reading this as safety.",
  ],
  [
    "No coverage yet",
    "No sources are registered or ingested for that area or topic yet.",
  ],
];

const WINDOWS = [
  [
    "Security incident",
    "2 hours",
    "1 official source, or 2 independent T2 sources",
  ],
  ["Flood or weather warning", "6 hours", "1 official source"],
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-5 py-10 text-zinc-800 dark:text-zinc-200">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-zinc-500 underline">
          ← Back to checking
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          How Amana Check decides
        </h1>
        <p className="text-base leading-7 text-zinc-600 dark:text-zinc-400">
          Amana Check does not decide what is true. It reports what its ingested
          sources say, when they said it, and how strong that evidence is — and
          it refuses to answer when the evidence is missing or stale.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Source tiers
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-300 dark:border-zinc-700">
                <th className="py-2 pr-4 font-medium">Tier</th>
                <th className="py-2 pr-4 font-medium">Kind</th>
                <th className="py-2 font-medium">Examples</th>
              </tr>
            </thead>
            <tbody>
              {SOURCE_TIERS.map(([tier, kind, examples]) => (
                <tr
                  key={tier}
                  className="border-b border-zinc-200 align-top dark:border-zinc-800"
                >
                  <td className="py-2 pr-4 font-mono">{tier}</td>
                  <td className="py-2 pr-4">{kind}</td>
                  <td className="py-2 text-zinc-600 dark:text-zinc-400">
                    {examples}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Freshness windows
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Different claims age differently. A passport requirement can tolerate
          days; a security incident needs very recent corroboration.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-300 dark:border-zinc-700">
                <th className="py-2 pr-4 font-medium">Claim type</th>
                <th className="py-2 pr-4 font-medium">Window</th>
                <th className="py-2 font-medium">A verdict needs</th>
              </tr>
            </thead>
            <tbody>
              {WINDOWS.map(([type, window, requirement]) => (
                <tr
                  key={type}
                  className="border-b border-zinc-200 align-top dark:border-zinc-800"
                >
                  <td className="py-2 pr-4">{type}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{window}</td>
                  <td className="py-2 text-zinc-600 dark:text-zinc-400">
                    {requirement}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          What the statuses mean
        </h2>
        <ul className="flex flex-col gap-3 text-sm">
          {STATUSES.map(([label, detail]) => (
            <li key={label}>
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                {label}
              </p>
              <p className="text-zinc-600 dark:text-zinc-400">{detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          How the AI is used
        </h2>
        <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-400">
          The model does three jobs: it understands the message and its
          language, it translates the search into English, and it writes the
          final answer in the user&apos;s language using only the evidence it is
          given. It never chooses facts, never changes the status, and every
          factual bullet must carry a citation that the server validates. If
          synthesis fails validation twice, Amana falls back to direct source
          excerpts instead of a summary.
        </p>
        <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-400">
          Model requests are routed only to providers with zero data retention
          and no training on prompts. If no compliant provider is available, the
          check fails closed rather than sending the message through a provider
          that retains it.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Privacy
        </h2>
        <ul className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <li>
            No accounts, no phone numbers, no device identifiers. IP addresses
            are stored only as keyed hashes for rate limiting and locale hints,
            in tables isolated from checks.
          </li>
          <li>
            Checks are retained without identity to improve coverage and
            evaluation. They are never shown to other users.
          </li>
          <li>
            The peacebuilder view shows aggregated demand only, suppressed below
            three checks in a region, topic, and day bucket. It measures what
            people are checking, not what is happening.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Limitations
        </h2>
        <ul className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <li>
            Coverage is limited to sources Amana has ingested for Nigeria and
            Kenya. A thin corpus produces honest refusals, not guesses.
          </li>
          <li>
            Yoruba, Igbo, and Hausa answers are machine-generated and labelled
            as such; native-speaker review is planned.
          </li>
          <li>
            Browser translation of the English interface can add its own errors;
            the answer itself is written in the detected language.
          </li>
        </ul>
      </section>

      <Link
        href="/"
        className="text-sm font-medium text-sky-700 underline dark:text-sky-400"
      >
        Check a message
      </Link>
    </main>
  );
}
