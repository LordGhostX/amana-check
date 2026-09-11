"use client";

import { useEffect, useRef, useState, type SubmitEvent } from "react";
import type { AnswerTimings, AnswerVersionInfo } from "@/lib/pipeline/answer";
import type { ResolvedLocation } from "@/lib/locale/precedence";
import type { AnswerPayload } from "@/lib/trust/types";
import { AnswerCard } from "./answer-card";

interface AskResponse {
  answerId: number;
  claimHash: string;
  version: number;
  cached: boolean;
  payload: AnswerPayload;
  location: ResolvedLocation;
  extraction: {
    detectedLang: string;
    languageConfidence: number;
    claimType: string;
    sensitivity: string;
    locationHints: string[];
  };
  versions: AnswerVersionInfo[];
  timing: {
    totalMs: number;
    pipelineMs: number;
    stages: AnswerTimings["stages"];
  };
}

const CHECKS_KEY = "amana_checks_v1";

const EXAMPLES = [
  ["Flood alert", "NEMA has issued a flood alert for Benue State"],
  [
    "Cash offer",
    "FG dey give N73,941 to every trader in Zangon-Kataf if you register through this WhatsApp link today",
  ],
  ["Health rumor", "Kuna mlipuko wa kipindupindu katika kaunti ya Nairobi"],
];

function readChecks(): Record<string, { version: number }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CHECKS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, { version: number }>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function rememberCheck(claimHash: string, version: number) {
  if (typeof window === "undefined") return;
  try {
    const checks = readChecks();
    checks[claimHash] = { version };
    window.localStorage.setItem(CHECKS_KEY, JSON.stringify(checks));
  } catch {
    // localStorage is best-effort; never block answering.
  }
}

export function CheckForm() {
  const statusRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [updatedSince, setUpdatedSince] = useState(false);

  useEffect(() => {
    if (state === "idle") return;

    const frame = window.requestAnimationFrame(() => {
      statusRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [state]);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = text.trim();
    if (trimmed.length < 3 || state === "loading") return;

    setState("loading");
    setError(null);
    setResponse(null);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          country: country === "" ? undefined : country,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;
        throw new Error(
          data?.error === "rate_limited"
            ? "Too many checks from this connection. Please try again later."
            : (data?.message ??
                "Amana could not complete this check. Please try again."),
        );
      }
      const data = (await res.json()) as AskResponse;
      const previous = readChecks()[data.claimHash];
      setUpdatedSince(Boolean(previous && previous.version < data.version));
      rememberCheck(data.claimHash, data.version);
      setResponse(data);
      setState("done");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Something went wrong. Please try again.",
      );
      setState("error");
    }
  }

  return (
    <div className="min-w-0 lg:-mt-10">
      <form
        onSubmit={onSubmit}
        className="overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-[0_28px_80px_-36px_rgba(17,37,31,0.38)]"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-full bg-brand-soft text-brand-strong"
            >
              ?
            </span>
            <div>
              <h2 className="font-semibold tracking-[-0.02em] text-ink">
                Check a claim
              </h2>
              <p className="text-xs text-muted">
                A check may take around a minute
              </p>
            </div>
          </div>
          <span className="hidden items-center gap-2 text-xs font-medium text-muted sm:flex">
            <span className="size-2 rounded-full bg-accent shadow-[0_0_0_3px_rgba(217,247,95,0.12)]" />
            No account required
          </span>
        </div>

        <div className="p-5 sm:p-6">
          <label htmlFor="claim" className="sr-only">
            Paste a rumor, message, or question
          </label>
          <div className="rounded-2xl border border-line bg-background">
            <textarea
              id="claim"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={7}
              maxLength={4000}
              placeholder="Paste the message exactly as you received it. Any language works."
              className="min-h-44 w-full resize-y bg-transparent px-4 pt-4 pb-2 text-base leading-7 text-ink placeholder:text-muted/70 sm:px-5 sm:pt-5"
            />
            <div className="flex items-center justify-between border-t border-line/80 px-4 pt-3 pb-3 text-xs text-muted sm:px-5">
              <span>Rumor, question, link text, or voice-note transcript</span>
              <span className="font-mono tabular-nums">{text.length}/4000</span>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium text-ink">
              Where should we check?
              <select
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className="h-12 rounded-xl border border-line bg-background px-3 text-sm font-normal text-ink transition-colors outline-none hover:border-muted focus:border-brand"
              >
                <option value="">Choose automatically</option>
                <option value="NG">Nigeria</option>
                <option value="KE">Kenya</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={state === "loading" || text.trim().length < 3}
              className="group flex h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-[0_8px_22px_-10px_rgba(15,113,91,0.9)] transition-all hover:-translate-y-0.5 hover:bg-[#095343] disabled:translate-y-0 disabled:opacity-45 sm:min-w-40"
            >
              {state === "loading" ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                  Checking
                </>
              ) : (
                <>
                  Check it <span aria-hidden="true">→</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-6 border-t border-line pt-5">
            <p className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">
              Try an example
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLES.map(([label, example]) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setText(example)}
                  className="rounded-full border border-line bg-background px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-brand hover:text-brand-strong"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="border-t border-line bg-surface-muted/65 px-5 py-3 text-xs leading-5 text-muted sm:px-6">
          Amana answers in the message&apos;s language. Checks may be stored
          without your identity to improve coverage.
        </p>
      </form>

      <div ref={statusRef} aria-live="polite" className="mt-5 scroll-mt-24">
        {state === "loading" ? (
          <div className="overflow-hidden rounded-2xl border border-brand/20 bg-brand-soft p-5 text-sm text-ink">
            <div className="flex items-center gap-3">
              <span className="relative flex size-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-40" />
                <span className="relative inline-flex size-3 rounded-full bg-accent shadow-[0_0_0_3px_rgba(217,247,95,0.12)]" />
              </span>
              <p className="font-semibold">Checking the message</p>
            </div>
            <div className="mt-4 grid gap-2 text-muted sm:grid-cols-3">
              <p>Reading the claim</p>
              <p>Searching trusted sources</p>
              <p>Checking dates and coverage</p>
            </div>
          </div>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="rounded-2xl border border-red-300 bg-red-50 px-5 py-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
          >
            <span className="font-semibold">The check did not finish.</span>{" "}
            {error}
          </p>
        ) : null}

        {response ? (
          <AnswerCard
            payload={response.payload}
            answerId={response.answerId}
            versions={response.versions}
            updatedSince={updatedSince}
            durationMs={response.timing.totalMs}
          />
        ) : null}
      </div>
    </div>
  );
}
