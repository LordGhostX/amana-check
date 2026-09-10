"use client";

import { useState, type FormEvent } from "react";
import type { AnswerVersionInfo } from "@/lib/pipeline/answer";
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
  preferredLang: string;
}

const CHECKS_KEY = "amana_checks_v1";

const EXAMPLES = [
  "NEMA has issued a flood alert for Benue State",
  "Dem talk say FG dey give N75,000, make you register with dis link, na true?",
  "Kuna mlipuko wa kipindupindu katika kaunti ya Nairobi",
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
  const [text, setText] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [updatedSince, setUpdatedSince] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
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
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label
          htmlFor="claim"
          className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
        >
          Paste a message, claim, or question
        </label>
        <textarea
          id="claim"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="Any language works. For example: “Dem talk say FG dey give N75,000, na true?”"
          className="w-full resize-y rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-300"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={state === "loading" || text.trim().length < 3}
            className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
          >
            {state === "loading" ? "Checking…" : "Check before you share"}
          </button>
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            Focus
            <select
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">Auto (from claim and region)</option>
              <option value="NG">Nigeria</option>
              <option value="KE">Kenya</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-zinc-500">
          Amana reads the language of your message and answers in it. It uses
          official and trusted sources only, and says when evidence is missing
          or too old.
        </p>
      </form>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setText(example)}
            className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
          >
            {example.length > 48 ? `${example.slice(0, 48)}…` : example}
          </button>
        ))}
      </div>

      {state === "loading" ? (
        <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          <p className="animate-pulse font-medium">
            Understanding the message…
          </p>
          <p>Searching trusted sources and checking freshness.</p>
          <p className="text-xs text-zinc-500">
            This can take up to 20 seconds on a slow connection.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {response ? (
        <AnswerCard
          payload={response.payload}
          answerId={response.answerId}
          versions={response.versions}
          updatedSince={updatedSince}
        />
      ) : null}
    </div>
  );
}
