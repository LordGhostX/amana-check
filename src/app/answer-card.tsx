"use client";

import { useMemo, useState } from "react";
import type { AnswerPayload, AnswerStatus } from "@/lib/trust/types";
import type { AnswerVersionInfo } from "@/lib/pipeline/answer";

const STATUS_META: Record<
  AnswerStatus,
  { label: string; description: string; className: string }
> = {
  verified: {
    label: "Verified",
    description: "Evidence meets the freshness and source requirements.",
    className:
      "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  developing: {
    label: "Developing",
    description:
      "Some evidence exists, but not enough to verify. Treat with caution.",
    className:
      "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  },
  unverified: {
    label: "Not verified",
    description:
      "No supporting or contradicting source was found. The claim is neither confirmed nor denied.",
    className:
      "border-zinc-300 bg-zinc-50 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
  },
  not_confirmed_stale: {
    label: "Not confirmed: evidence too old",
    description:
      "Our sources are older than the freshness window for this kind of claim. Do not read this as safe.",
    className:
      "border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200",
  },
  unknown_coverage: {
    label: "No coverage yet",
    description:
      "Amana has no ingested sources for this area or topic yet, so it cannot check this claim.",
    className:
      "border-zinc-300 bg-zinc-50 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
  },
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "date unknown";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function stripCitations(value: string): string {
  return value
    .replace(/\[S\d+\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildShareText(payload: AnswerPayload): string {
  const meta = STATUS_META[payload.status];
  const publishers = Array.from(
    new Set(payload.evidence.map((item) => item.publisher)),
  );
  return [
    "AMANA CHECK: check before you share",
    `Claim: ${payload.claim}`,
    `Status: ${meta.label}`,
    ...payload.whatWeKnow.map((bullet) => `- ${stripCitations(bullet)}`),
    publishers.length > 0 ? `Sources: ${publishers.join(", ")}` : "",
    `Checked: ${new Date(payload.checkedAt).toLocaleString()}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function AnswerCard({
  payload,
  answerId,
  versions,
  updatedSince,
}: {
  payload: AnswerPayload;
  answerId: number;
  versions: AnswerVersionInfo[];
  updatedSince: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [feedbackState, setFeedbackState] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const meta = STATUS_META[payload.status];
  const shareText = useMemo(() => buildShareText(payload), [payload]);

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  async function sendFeedback(rating: "helpful" | "not_helpful" | "wrong") {
    setFeedbackState("sending");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId, rating }),
      });
      setFeedbackState(response.ok ? "sent" : "error");
    } catch {
      setFeedbackState("error");
    }
  }

  return (
    <article
      lang={payload.answerLang}
      translate="no"
      className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-sm font-medium ${meta.className}`}
          >
            {meta.label}
          </span>
          {payload.machineTranslated ? (
            <span className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
              Machine-translated
            </span>
          ) : null}
          <span className="text-xs text-zinc-500">
            Checked {new Date(payload.checkedAt).toLocaleString()}
          </span>
        </div>

        {updatedSince ? (
          <p className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200">
            Updated since you last checked this claim.
          </p>
        ) : null}

        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
            What you sent
          </p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {payload.claim}
          </p>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {meta.description} {payload.statusReason}
        </p>
      </header>

      {payload.whatWeKnow.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            What we know
          </h2>
          <ul className="flex flex-col gap-2">
            {payload.whatWeKnow.map((bullet, index) => (
              <li
                key={index}
                className="flex gap-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300"
              >
                <span aria-hidden className="text-zinc-400">
                  •
                </span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {payload.whatWeDontKnow.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            What we don&apos;t know
          </h2>
          <ul className="flex flex-col gap-2">
            {payload.whatWeDontKnow.map((bullet, index) => (
              <li
                key={index}
                className="flex gap-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400"
              >
                <span aria-hidden className="text-zinc-400">
                  ?
                </span>
                <span>{stripCitations(bullet)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {payload.evidence.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Evidence
          </h2>
          <div className="flex flex-col gap-2">
            {payload.evidence.map((item, index) => {
              const sourceUrl = /^https?:\/\//i.test(item.url)
                ? item.url
                : null;
              return (
                <details
                  key={`${item.documentId}-${index}`}
                  className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
                >
                  <summary className="cursor-pointer text-sm text-zinc-800 dark:text-zinc-200">
                    {item.publisher} · T{item.tier} ·{" "}
                    {formatDate(item.publishedAt)}
                  </summary>
                  <div className="mt-2 flex flex-col gap-2">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {item.title}
                    </p>
                    {item.excerpt ? (
                      <p className="text-sm text-zinc-500 italic dark:text-zinc-500">
                        &quot;{item.excerpt}&quot;
                      </p>
                    ) : null}
                    {sourceUrl ? (
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-sky-700 underline dark:text-sky-400"
                      >
                        Open original source
                      </a>
                    ) : null}
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      ) : null}

      {payload.nextSteps.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            What you can do now
          </h2>
          <ol className="flex flex-col gap-2">
            {payload.nextSteps.map((step, index) => (
              <li
                key={index}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <p className="font-medium text-zinc-800 dark:text-zinc-200">
                  {step.title}
                </p>
                {step.detail ? (
                  <p className="text-zinc-600 dark:text-zinc-400">
                    {step.detail}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <footer className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyShare}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
          >
            {copied ? "Copied" : "Share what we know"}
          </button>
          <span className="text-xs text-zinc-500">
            Shares a source-stamped summary, not the original rumor.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-500">Was this useful?</span>
          {(
            [
              ["helpful", "Helpful"],
              ["not_helpful", "Not helpful"],
              ["wrong", "Wrong"],
            ] as const
          ).map(([rating, label]) => (
            <button
              key={rating}
              type="button"
              disabled={feedbackState === "sending" || feedbackState === "sent"}
              onClick={() => sendFeedback(rating)}
              className="rounded-lg border border-zinc-300 px-3 py-1 text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              {label}
            </button>
          ))}
          {feedbackState === "sent" ? (
            <span className="text-emerald-700 dark:text-emerald-400">
              Thank you.
            </span>
          ) : null}
          {feedbackState === "error" ? (
            <span className="text-red-700 dark:text-red-400">
              Could not send.
            </span>
          ) : null}
        </div>

        {versions.length > 1 ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">
              Version history ({versions.length})
            </summary>
            <ul className="mt-2 flex flex-col gap-1">
              {versions.map((version) => (
                <li
                  key={version.version}
                  className="flex flex-wrap gap-2 text-zinc-500"
                >
                  <span>v{version.version}</span>
                  <span>{STATUS_META[version.status].label}</span>
                  <span>{new Date(version.changedAt).toLocaleString()}</span>
                  {version.changeReason ? (
                    <span>({version.changeReason})</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </footer>
    </article>
  );
}
