"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { AnswerPayload, AnswerStatus } from "@/lib/trust/types";
import type { AnswerVersionInfo } from "@/lib/pipeline/answer";
import { withUtmSource } from "@/lib/links";
import {
  getEvidenceReferences,
  sourceNumbersFor,
  type EvidenceReferences,
} from "@/lib/trust/references";

const STATUS_META: Record<
  AnswerStatus,
  {
    label: string;
    description: string;
    badgeClass: string;
    panelClass: string;
    symbol: string;
  }
> = {
  verified: {
    label: "Verified",
    description: "Evidence meets the freshness and source requirements.",
    badgeClass: "bg-emerald-700 text-white",
    panelClass: "border-emerald-300 bg-emerald-50",
    symbol: "✓",
  },
  developing: {
    label: "Developing",
    description:
      "Some evidence exists, but not enough to verify. Treat with caution.",
    badgeClass: "bg-amber-500 text-amber-950",
    panelClass: "border-amber-300 bg-amber-50",
    symbol: "~",
  },
  unverified: {
    label: "Not verified",
    description:
      "No supporting or contradicting source was found. The claim is neither confirmed nor denied.",
    badgeClass: "bg-slate-700 text-white",
    panelClass: "border-slate-300 bg-slate-50",
    symbol: "?",
  },
  not_confirmed_stale: {
    label: "Not confirmed: evidence too old",
    description:
      "Our sources are older than the freshness window for this kind of claim. Do not read this as safe.",
    badgeClass: "bg-orange-600 text-white",
    panelClass: "border-orange-300 bg-orange-50",
    symbol: "!",
  },
  unknown_coverage: {
    label: "No coverage yet",
    description:
      "Amana has no ingested sources for this area or topic yet, so it cannot check this claim.",
    badgeClass: "bg-slate-700 text-white",
    panelClass: "border-slate-300 bg-slate-50",
    symbol: "?",
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
    .replace(/\s*\[S\d+\]/g, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function formatShareDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

function renderCitations(
  value: string,
  numberByCitation: Map<number, number>,
): ReactNode[] {
  return [
    stripCitations(value),
    ...sourceNumbersFor(value, numberByCitation).map((sourceNumber) => (
      <a
        key={sourceNumber}
        href={`#evidence-${sourceNumber}`}
        className="ml-1 inline-flex min-w-5 items-center justify-center rounded bg-brand-soft px-1 font-mono text-[0.7rem] font-semibold text-brand-strong no-underline"
        aria-label={`See evidence source ${sourceNumber}`}
      >
        {sourceNumber}
      </a>
    )),
  ];
}

function verdictReason(payload: AnswerPayload, fallback: string): string {
  return payload.statusReason.trim() || fallback;
}

function buildShareText(
  payload: AnswerPayload,
  references: EvidenceReferences,
): string {
  const meta = STATUS_META[payload.status];
  const reason = verdictReason(payload, meta.description);
  const sourceLines = references.items.flatMap(({ item, number }) => {
    const heading = `${number}. ${item.publisher}: ${item.title} (${formatDate(item.publishedAt)})`;
    return /^https?:\/\//i.test(item.url)
      ? [heading, `   ${withUtmSource(item.url)}`]
      : [heading];
  });

  return [
    "Amana Check",
    "",
    "Claim",
    payload.claim,
    "",
    "Verdict",
    meta.label,
    reason,
    "",
    ...(payload.whatWeKnow.length > 0 ? ["What the sources say"] : []),
    ...payload.whatWeKnow.map((bullet) => `- ${stripCitations(bullet)}`),
    ...(payload.whatWeKnow.length > 0 ? [""] : []),
    ...(payload.whatWeDontKnow.length > 0 ? ["What remains unclear"] : []),
    ...payload.whatWeDontKnow.map((bullet) => `- ${stripCitations(bullet)}`),
    ...(payload.whatWeDontKnow.length > 0 ? [""] : []),
    ...(sourceLines.length > 0 ? ["Sources", ...sourceLines, ""] : []),
    `Checked ${formatShareDate(payload.checkedAt)}`,
  ].join("\n");
}

export function AnswerCard({
  payload,
  answerId,
  versions,
  updatedSince,
  durationMs,
}: {
  payload: AnswerPayload;
  answerId: number;
  versions: AnswerVersionInfo[];
  updatedSince: boolean;
  durationMs: number;
}) {
  const [copied, setCopied] = useState(false);
  const [feedbackState, setFeedbackState] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const meta = STATUS_META[payload.status];
  const reason = verdictReason(payload, meta.description);
  const evidenceReferences = useMemo(
    () => getEvidenceReferences(payload),
    [payload],
  );
  const shareText = useMemo(
    () => buildShareText(payload, evidenceReferences),
    [payload, evidenceReferences],
  );

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
      className="overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-[0_24px_70px_-40px_rgb(var(--panel-rgb)/0.2)]"
    >
      <header className={`border-b p-5 sm:p-6 ${meta.panelClass}`}>
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className={`grid size-11 shrink-0 place-items-center rounded-full text-lg font-bold ${meta.badgeClass}`}
          >
            {meta.symbol}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-[-0.035em] text-ink">
                {meta.label}
              </h2>
              {payload.machineTranslated ? (
                <span className="rounded-full border border-current/20 px-2 py-0.5 text-xs font-medium text-muted">
                  Machine-translated
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm leading-6 text-muted">{reason}</p>
            <p className="mt-3 flex flex-wrap gap-x-2 font-mono text-xs text-muted">
              <span>
                Checked {new Date(payload.checkedAt).toLocaleString()}
              </span>
              <span aria-hidden="true">·</span>
              <span>Completed in {formatDuration(durationMs)}</span>
            </p>
          </div>
        </div>

        {updatedSince ? (
          <p className="mt-4 rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900">
            This answer changed since your last check.
          </p>
        ) : null}
      </header>

      <div className="p-5 sm:p-6">
        <section className="rounded-2xl bg-surface-muted p-4 sm:p-5">
          <p className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">
            What you sent
          </p>
          <p className="mt-2 text-base leading-7 font-medium text-ink">
            &quot;{payload.claim}&quot;
          </p>
        </section>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {payload.whatWeKnow.length > 0 ? (
            <section className="rounded-2xl border border-line p-4 sm:p-5">
              <h3 className="flex items-center gap-2 font-semibold text-ink">
                <span aria-hidden="true" className="text-brand-strong">
                  ✓
                </span>
                What we know
              </h3>
              <ul className="mt-3 flex flex-col gap-3">
                {payload.whatWeKnow.map((bullet, index) => (
                  <li key={index} className="text-sm leading-6 text-foreground">
                    {renderCitations(
                      bullet,
                      evidenceReferences.numberByCitation,
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {payload.whatWeDontKnow.length > 0 ? (
            <section className="rounded-2xl border border-line p-4 sm:p-5">
              <h3 className="flex items-center gap-2 font-semibold text-ink">
                <span aria-hidden="true" className="text-amber-600">
                  ?
                </span>
                What we don&apos;t know
              </h3>
              <ul className="mt-3 flex flex-col gap-3">
                {payload.whatWeDontKnow.map((bullet, index) => (
                  <li key={index} className="text-sm leading-6 text-muted">
                    {renderCitations(
                      bullet,
                      evidenceReferences.numberByCitation,
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {evidenceReferences.items.length > 0 ? (
          <section className="mt-7">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.12em] text-brand-strong uppercase">
                  Source trail
                </p>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-ink">
                  Evidence checked
                </h3>
              </div>
              <span className="font-mono text-xs text-muted">
                {evidenceReferences.items.length} source
                {evidenceReferences.items.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {evidenceReferences.items.map(({ item, number }) => {
                const sourceUrl = /^https?:\/\//i.test(item.url)
                  ? withUtmSource(item.url)
                  : null;
                return (
                  <details
                    key={item.documentId}
                    id={`evidence-${number}`}
                    className="group rounded-2xl border border-line bg-background px-4 py-3 open:bg-surface"
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-3 text-sm text-ink marker:hidden">
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft font-mono text-xs font-semibold text-brand-strong">
                        {number}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">{item.publisher}</span>
                        <span className="ml-2 text-muted">
                          T{item.tier} · {formatDate(item.publishedAt)}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className="text-muted transition-transform group-open:rotate-45"
                      >
                        +
                      </span>
                    </summary>
                    <div className="mt-3 border-t border-line pt-3 pl-10">
                      <p className="text-sm leading-6 text-foreground">
                        {item.title}
                      </p>
                      {item.excerpt ? (
                        <p className="mt-2 border-l-2 border-line pl-3 text-sm leading-6 text-muted italic">
                          &quot;{item.excerpt}&quot;
                        </p>
                      ) : null}
                      {sourceUrl ? (
                        <a
                          href={sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-strong underline decoration-brand/30 underline-offset-4"
                        >
                          Read original source <span aria-hidden="true">↗</span>
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
          <section className="mt-7 rounded-2xl bg-panel p-5 text-white">
            <h3 className="text-lg font-semibold tracking-[-0.02em]">
              What you can do now
            </h3>
            <ol className="mt-4 flex flex-col gap-4">
              {payload.nextSteps.map((step, index) => (
                <li key={index} className="flex gap-3 text-sm">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft font-mono text-xs font-semibold text-brand-strong ring-1 ring-white/10 ring-inset">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-white">{step.title}</p>
                    {step.detail ? (
                      <p className="mt-1 leading-6 text-white/65">
                        {step.detail}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>

      <footer className="border-t border-line bg-surface-muted/60 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={copyShare}
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
          >
            {copied ? "Copied to clipboard" : "Copy sourced summary"}
          </button>
          <p className="text-xs leading-5 text-muted">
            Includes the verdict, findings, open questions, and source links.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4 text-sm">
          <span className="mr-1 text-muted">Did this answer help?</span>
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
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-foreground transition-colors hover:border-brand disabled:opacity-50"
            >
              {label}
            </button>
          ))}
          {feedbackState === "sent" ? (
            <span className="font-medium text-emerald-700">Thanks.</span>
          ) : null}
          {feedbackState === "error" ? (
            <span className="text-red-700">Could not send.</span>
          ) : null}
        </div>

        {versions.length > 1 ? (
          <details className="mt-4 border-t border-line pt-4 text-sm">
            <summary className="cursor-pointer font-medium text-muted">
              Version history ({versions.length})
            </summary>
            <ul className="mt-2 flex flex-col gap-1">
              {versions.map((version) => (
                <li
                  key={version.version}
                  className="flex flex-wrap gap-2 text-muted"
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
