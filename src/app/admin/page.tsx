import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminCookie } from "@/lib/admin/auth";
import { dashboardData, listReviewQueue, sourceHealth } from "@/lib/admin/data";
import { AdminConsole } from "./admin-console";
import { AdminLogin } from "./admin-login";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review console: Amana Check",
  robots: { index: false },
};

type AdminTab = "queue" | "dashboard" | "sources" | "brief";

const ADMIN_TABS: ReadonlySet<string> = new Set([
  "queue",
  "dashboard",
  "sources",
  "brief",
]);

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [cookieStore, params] = await Promise.all([cookies(), searchParams]);
  const authed = isAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value);
  const requestedTab = typeof params.tab === "string" ? params.tab : "queue";
  const initialTab = (
    ADMIN_TABS.has(requestedTab) ? requestedTab : "queue"
  ) as AdminTab;

  if (!authed) {
    return (
      <main className="page-grid grid flex-1 place-items-center px-5 py-12">
        <div className="w-full max-w-md overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-[0_28px_80px_-36px_rgb(var(--panel-rgb)/0.2)]">
          <header className="border-b border-line p-6">
            <p className="font-mono text-xs tracking-[0.16em] text-brand-strong uppercase">
              Restricted access
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-ink">
              Review console
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              Sign in to review answers and read aggregated verification demand.
            </p>
          </header>
          <div className="p-6">
            <AdminLogin />
          </div>
        </div>
      </main>
    );
  }

  const [queue, dashboard, sources] = await Promise.all([
    listReviewQueue(),
    dashboardData(7),
    sourceHealth(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-7xl min-w-0 flex-1 flex-col gap-8 overflow-x-clip px-4 py-10 sm:px-8 sm:py-14">
      <header className="grid min-w-0 gap-4 md:grid-cols-[1fr_0.8fr] md:items-end">
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-[0.16em] text-brand-strong uppercase">
            Operations
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tighter text-ink sm:text-5xl">
            Review console
          </h1>
        </div>
        <p className="min-w-0 text-sm leading-6 wrap-break-word text-muted">
          Review and correct answers, and read aggregated verification demand.
          The dashboard shows what communities are checking, so its counts are
          not incident reports.
        </p>
      </header>
      <AdminConsole
        initialQueue={queue}
        initialDashboard={dashboard}
        sources={sources}
        initialTab={initialTab}
      />
    </main>
  );
}
