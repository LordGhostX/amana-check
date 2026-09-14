"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  DashboardData,
  ReviewQueueItem,
  SourceHealthItem,
} from "@/lib/admin/data";
import { ANSWER_STATUSES, type AnswerStatus } from "@/lib/trust/types";

type Tab = "queue" | "dashboard" | "sources" | "brief";

type Notice = {
  kind: "success" | "error";
  text: string;
};

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
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showNotice(nextNotice: Notice) {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(nextNotice);
    noticeTimer.current = setTimeout(() => {
      setNotice(null);
      noticeTimer.current = null;
    }, 4500);
  }

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {notice ? (
        <div className="pointer-events-none fixed inset-x-4 top-24 z-40 sm:right-6 sm:left-auto sm:w-full sm:max-w-sm">
          <div
            role={notice.kind === "error" ? "alert" : "status"}
            aria-live={notice.kind === "error" ? "assertive" : "polite"}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-[0_18px_45px_-24px_rgb(var(--panel-rgb)/0.28)] ${
              notice.kind === "success"
                ? "border-brand/30 bg-brand-soft text-ink"
                : "border-red-300 bg-red-50 text-red-800"
            }`}
          >
            <span
              aria-hidden="true"
              className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                notice.kind === "success"
                  ? "bg-brand text-white"
                  : "bg-red-600 text-white"
              }`}
            >
              {notice.kind === "success" ? "✓" : "!"}
            </span>
            <p className="min-w-0 flex-1 pt-0.5 font-medium">{notice.text}</p>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => {
                if (noticeTimer.current) clearTimeout(noticeTimer.current);
                noticeTimer.current = null;
                setNotice(null);
              }}
              className="-mt-1 -mr-1 rounded-full p-1 text-current/70 transition-colors hover:bg-black/5 hover:text-current"
            >
              <span aria-hidden="true" className="text-lg leading-none">
                ×
              </span>
            </button>
          </div>
        </div>
      ) : null}
      <div className="min-w-0 rounded-2xl border border-line bg-surface p-2 shadow-sm">
        <div className="grid min-w-0 grid-cols-2 gap-1 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
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
              className={`min-w-0 rounded-xl px-3 py-2 text-center text-sm font-semibold transition-colors ${
                tab === value
                  ? "bg-brand text-white shadow-sm"
                  : "text-ink hover:bg-surface-muted hover:text-brand-strong"
              }`}
            >
              <span className="sm:hidden">
                {value === "dashboard" ? "Demand" : label}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={logout}
            className="col-span-2 w-full rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 sm:ml-auto sm:w-auto"
          >
            Sign out
          </button>
        </div>
      </div>

      {tab === "queue" ? (
        initialQueue.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
            Nothing awaiting review. New answers appear here automatically.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {initialQueue.map((item) => (
              <QueueItemCard
                key={item.answerId}
                item={item}
                onNotice={showNotice}
              />
            ))}
          </div>
        )
      ) : null}

      {tab === "dashboard" ? (
        <div className="flex flex-col gap-5">
          <p className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            {initialDashboard.disclaimer}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-line bg-surface p-5">
              <p className="font-mono text-3xl font-semibold tracking-[-0.04em] text-ink">
                {initialDashboard.totalChecks}
              </p>
              <p className="mt-1 text-sm text-muted">
                Checks in {initialDashboard.days} days
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-5">
              <p className="font-mono text-3xl font-semibold tracking-[-0.04em] text-ink">
                {initialDashboard.distinctClusters}
              </p>
              <p className="mt-1 text-sm text-muted">Distinct clusters</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-5">
              <p className="text-sm font-semibold text-ink">Privacy floor</p>
              <p className="mt-2 text-sm leading-5 text-muted">
                {initialDashboard.suppression}
              </p>
            </div>
          </div>
          {initialDashboard.buckets.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
              No bucket has reached three checks yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-surface-muted text-xs text-muted uppercase">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Country</th>
                      <th className="px-4 py-3 font-semibold">Region</th>
                      <th className="px-4 py-3 font-semibold">Topic</th>
                      <th className="px-4 py-3 font-semibold">Cluster</th>
                      <th className="px-4 py-3 font-semibold">Checks</th>
                      <th className="px-4 py-3 font-semibold">Statuses</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialDashboard.buckets.map((bucket) => (
                      <tr
                        key={`${bucket.bucketDate}-${bucket.country}-${bucket.region}-${bucket.claimCluster}`}
                        className="border-t border-line"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          {bucket.bucketDate}
                        </td>
                        <td className="px-4 py-3">{bucket.country}</td>
                        <td className="px-4 py-3">{bucket.region}</td>
                        <td className="px-4 py-3">{bucket.topic}</td>
                        <td className="px-4 py-3">{bucket.claimCluster}</td>
                        <td className="px-4 py-3 font-semibold">
                          {bucket.count}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {Object.entries(bucket.statusDistribution)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {tab === "sources" ? (
        <div className="flex flex-col gap-4">
          <p className="max-w-2xl text-sm leading-6 text-muted">
            Ingestion health by source. A source can succeed at the HTTP level
            yet yield nothing; the zero-yield streak makes that visible.
          </p>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-surface-muted text-xs text-muted uppercase">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Source</th>
                    <th className="px-4 py-3 font-semibold">Country</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Fetch</th>
                    <th className="px-4 py-3 font-semibold">Enabled</th>
                    <th className="px-4 py-3 font-semibold">Last success</th>
                    <th className="px-4 py-3 font-semibold">Failures</th>
                    <th className="px-4 py-3 font-semibold">Zero-yield</th>
                    <th className="px-4 py-3 font-semibold">Last run</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((source) => (
                    <tr
                      key={source.id}
                      className="border-t border-line align-top"
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ink">
                          {source.publisher}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-muted">
                          {source.id}
                        </p>
                      </td>
                      <td className="px-4 py-3">{source.country}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        T{source.tier} {source.type}
                      </td>
                      <td className="px-4 py-3">{source.fetchKind}</td>
                      <td className="px-4 py-3">
                        {source.enabled ? "yes" : "no"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted">
                        {source.lastSuccessAt
                          ? new Date(source.lastSuccessAt).toLocaleString()
                          : "never"}
                      </td>
                      <td
                        className={`px-4 py-3 ${source.consecutiveFailures > 0 ? "font-medium text-red-700" : ""}`}
                      >
                        {source.consecutiveFailures}
                      </td>
                      <td
                        className={`px-4 py-3 ${source.zeroYieldStreak >= 3 ? "font-medium text-amber-700" : ""}`}
                      >
                        {source.zeroYieldStreak}
                      </td>
                      <td className="px-4 py-3 text-muted">
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
        </div>
      ) : null}

      {tab === "brief" ? (
        <div className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted sm:p-7">
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-ink">
            Export a 30-day brief
          </h2>
          <p className="mt-2 max-w-2xl leading-6">
            Exports aggregated verification demand for the last 30 days. Only
            buckets with three or more checks are included; there is no personal
            data in this file.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href="/api/admin/brief?days=30&format=csv"
              className="rounded-xl bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-strong"
            >
              Download CSV
            </a>
            <a
              href="/api/admin/brief?days=30&format=json"
              className="rounded-xl border border-line bg-background px-4 py-2.5 font-semibold text-ink hover:border-brand"
            >
              Download JSON
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function QueueItemCard({
  item,
  onNotice,
}: {
  item: ReviewQueueItem;
  onNotice: (notice: Notice) => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<AnswerStatus>(item.status);
  const [know, setKnow] = useState(item.whatWeKnow.join("\n"));
  const [dontKnow, setDontKnow] = useState(item.whatWeDontKnow.join("\n"));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(action: "approve" | "correct") {
    setBusy(true);
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
        onNotice({ kind: "error", text: "Could not save the review." });
        return;
      }
      onNotice({
        kind: "success",
        text:
          action === "approve"
            ? "Answer approved and removed from the review queue."
            : "Correction saved and removed from the review queue.",
      });
      router.refresh();
    } catch {
      onNotice({ kind: "error", text: "Could not save the review." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 shadow-[0_18px_45px_-40px_rgb(var(--panel-rgb)/0.24)] sm:p-6">
      <header className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="rounded-full bg-brand-soft px-2.5 py-1 font-semibold text-brand-strong">
          {item.status}
        </span>
        <span className="rounded-full bg-surface-muted px-2.5 py-1">
          {item.claimType}
        </span>
        <span className="rounded-full bg-surface-muted px-2.5 py-1">
          {item.lang}
        </span>
        <span className="font-mono">v{item.version}</span>
        <span>{item.evidenceCount} evidence items</span>
        <span>{new Date(item.updatedAt).toLocaleString()}</span>
      </header>
      <p className="text-lg leading-7 font-medium text-ink">{item.claim}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-xs font-semibold text-muted">
          What we know (one per line)
          <textarea
            value={know}
            onChange={(event) => setKnow(event.target.value)}
            rows={6}
            className="min-h-40 resize-y rounded-xl border border-line bg-background px-3 py-2 text-sm leading-6 font-normal text-ink outline-none focus:border-brand"
          />
        </label>
        <label className="flex flex-col gap-2 text-xs font-semibold text-muted">
          What we don&apos;t know (one per line)
          <textarea
            value={dontKnow}
            onChange={(event) => setDontKnow(event.target.value)}
            rows={6}
            className="min-h-40 resize-y rounded-xl border border-line bg-background px-3 py-2 text-sm leading-6 font-normal text-ink outline-none focus:border-brand"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted">
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as AnswerStatus)}
            className="h-10 rounded-xl border border-line bg-background px-3 text-sm font-normal text-ink"
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
          placeholder="Reviewer note (kept with this review)"
          className="h-10 min-w-56 flex-1 rounded-xl border border-line bg-background px-3 text-sm text-ink outline-none placeholder:text-muted focus:border-brand"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => submit("approve")}
          className="h-10 rounded-xl border border-line bg-background px-4 text-sm font-semibold text-ink hover:border-brand disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => submit("correct")}
          className="h-10 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
        >
          Save correction
        </button>
      </div>
    </article>
  );
}
