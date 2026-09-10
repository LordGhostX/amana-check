"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  DashboardData,
  ReviewQueueItem,
  SourceHealthItem,
} from "@/lib/admin/data";
import { ANSWER_STATUSES, type AnswerStatus } from "@/lib/trust/types";

type Tab = "queue" | "dashboard" | "sources" | "brief";

export function AdminConsole({
  initialQueue,
  initialDashboard,
  sources,
  initialTab = "queue",
}: {
  initialQueue: ReviewQueueItem[];
  initialDashboard: DashboardData;
  sources: SourceHealthItem[];
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
        {(
          [
            ["queue", "Review queue"],
            ["dashboard", "Demand dashboard"],
            ["sources", "Sources"],
            ["brief", "Brief export"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === value
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "border border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={logout}
          className="ml-auto text-sm text-zinc-500 underline"
        >
          Sign out
        </button>
      </div>

      {tab === "queue" ? (
        initialQueue.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Nothing awaiting review. New answers appear here automatically.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {initialQueue.map((item) => (
              <QueueItemCard key={item.answerId} item={item} />
            ))}
          </div>
        )
      ) : null}

      {tab === "dashboard" ? (
        <div className="flex flex-col gap-4">
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {initialDashboard.disclaimer}
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            <span>
              {initialDashboard.totalChecks} checks in {initialDashboard.days}{" "}
              days
            </span>
            <span>{initialDashboard.distinctClusters} clusters</span>
            <span>{initialDashboard.suppression}</span>
          </div>
          {initialDashboard.buckets.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No bucket has reached three checks yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-300 dark:border-zinc-700">
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Country</th>
                    <th className="py-2 pr-3 font-medium">Region</th>
                    <th className="py-2 pr-3 font-medium">Topic</th>
                    <th className="py-2 pr-3 font-medium">Cluster</th>
                    <th className="py-2 pr-3 font-medium">Checks</th>
                    <th className="py-2 font-medium">Statuses</th>
                  </tr>
                </thead>
                <tbody>
                  {initialDashboard.buckets.map((bucket) => (
                    <tr
                      key={`${bucket.bucketDate}-${bucket.country}-${bucket.region}-${bucket.claimCluster}`}
                      className="border-b border-zinc-200 dark:border-zinc-800"
                    >
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {bucket.bucketDate}
                      </td>
                      <td className="py-2 pr-3">{bucket.country}</td>
                      <td className="py-2 pr-3">{bucket.region}</td>
                      <td className="py-2 pr-3">{bucket.topic}</td>
                      <td className="py-2 pr-3">{bucket.claimCluster}</td>
                      <td className="py-2 pr-3 font-medium">{bucket.count}</td>
                      <td className="py-2 text-zinc-500">
                        {Object.entries(bucket.statusDistribution)
                          .map(([key, value]) => `${key}: ${value}`)
                          .join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {tab === "sources" ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Ingestion health by source. A source can succeed at the HTTP level
            yet yield nothing; the zero-yield streak makes that visible.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-300 dark:border-zinc-700">
                  <th className="py-2 pr-3 font-medium">Source</th>
                  <th className="py-2 pr-3 font-medium">Country</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Fetch</th>
                  <th className="py-2 pr-3 font-medium">Enabled</th>
                  <th className="py-2 pr-3 font-medium">Last success</th>
                  <th className="py-2 pr-3 font-medium">Failures</th>
                  <th className="py-2 pr-3 font-medium">Zero-yield streak</th>
                  <th className="py-2 font-medium">Last run</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr
                    key={source.id}
                    className="border-b border-zinc-200 align-top dark:border-zinc-800"
                  >
                    <td className="py-2 pr-3">
                      <p className="font-medium text-zinc-800 dark:text-zinc-200">
                        {source.publisher}
                      </p>
                      <p className="text-xs text-zinc-500">{source.id}</p>
                    </td>
                    <td className="py-2 pr-3">{source.country}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      T{source.tier} {source.type}
                    </td>
                    <td className="py-2 pr-3">{source.fetchKind}</td>
                    <td className="py-2 pr-3">
                      {source.enabled ? "yes" : "no"}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-zinc-500">
                      {source.lastSuccessAt
                        ? new Date(source.lastSuccessAt).toLocaleString()
                        : "never"}
                    </td>
                    <td
                      className={`py-2 pr-3 ${source.consecutiveFailures > 0 ? "font-medium text-red-700 dark:text-red-400" : ""}`}
                    >
                      {source.consecutiveFailures}
                    </td>
                    <td
                      className={`py-2 pr-3 ${source.zeroYieldStreak >= 3 ? "font-medium text-amber-700 dark:text-amber-400" : ""}`}
                    >
                      {source.zeroYieldStreak}
                    </td>
                    <td className="py-2 text-zinc-500">
                      {source.lastRunAdded == null
                        ? "no runs"
                        : `+${source.lastRunAdded} new, ${source.lastRunUpdated ?? 0} updated`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "brief" ? (
        <div className="flex flex-col gap-3 text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            Exports aggregated verification demand for the last 30 days. Only
            buckets with three or more checks are included; there is no personal
            data in this file.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="/api/admin/brief?days=30&format=csv"
              className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
            >
              Download CSV
            </a>
            <a
              href="/api/admin/brief?days=30&format=json"
              className="rounded-lg border border-zinc-300 px-4 py-2 font-medium text-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
            >
              Download JSON
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function QueueItemCard({ item }: { item: ReviewQueueItem }) {
  const router = useRouter();
  const [status, setStatus] = useState<AnswerStatus>(item.status);
  const [know, setKnow] = useState(item.whatWeKnow.join("\n"));
  const [dontKnow, setDontKnow] = useState(item.whatWeDontKnow.join("\n"));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(action: "approve" | "correct") {
    setBusy(true);
    setMessage(null);
    try {
      const body =
        action === "approve"
          ? { action, answerId: item.answerId, note: note.trim() || undefined }
          : {
              action,
              answerId: item.answerId,
              status,
              whatWeKnow: know
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .slice(0, 3),
              whatWeDontKnow: dontKnow
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .slice(0, 3),
              note: note.trim() || undefined,
            };
      const response = await fetch("/api/admin/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setMessage("Could not save.");
        return;
      }
      setMessage(action === "approve" ? "Approved." : "Correction saved.");
      router.refresh();
    } catch {
      setMessage("Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <header className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <span className="rounded-full border border-zinc-300 px-2 py-0.5 dark:border-zinc-700">
          {item.status}
        </span>
        <span>{item.claimType}</span>
        <span>lang: {item.lang}</span>
        <span>v{item.version}</span>
        <span>{item.evidenceCount} evidence items</span>
        <span>{new Date(item.updatedAt).toLocaleString()}</span>
      </header>
      <p className="text-sm text-zinc-800 dark:text-zinc-200">{item.claim}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          What we know (one per line)
          <textarea
            value={know}
            onChange={(event) => setKnow(event.target.value)}
            rows={3}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          What we don&apos;t know (one per line)
          <textarea
            value={dontKnow}
            onChange={(event) => setDontKnow(event.target.value)}
            rows={3}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-zinc-500">
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as AnswerStatus)}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            {ANSWER_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Reviewer note (shown in version history)"
          className="min-w-56 flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => submit("approve")}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50 dark:border-zinc-700"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => submit("correct")}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          Save correction
        </button>
        {message ? (
          <span className="text-xs text-zinc-500">{message}</span>
        ) : null}
      </div>
    </article>
  );
}
