import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminCookie } from "@/lib/admin/auth";
import { dashboardData, listReviewQueue, sourceHealth } from "@/lib/admin/data";
import { AdminConsole } from "./admin-console";
import { AdminLogin } from "./admin-login";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review console — Amana Check",
  robots: { index: false },
};

export default async function AdminPage() {
  const cookieStore = await cookies();
  const authed = isAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value);

  if (!authed) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Review console
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Enter the admin passcode to review answers and view aggregated
            verification demand.
          </p>
        </header>
        <AdminLogin />
      </main>
    );
  }

  const [queue, dashboard, sources] = await Promise.all([
    listReviewQueue(),
    dashboardData(7),
    sourceHealth(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Review console
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Review and correct answers, and read aggregated verification demand.
          The dashboard measures what communities are checking, not what is
          happening.
        </p>
      </header>
      <AdminConsole
        initialQueue={queue}
        initialDashboard={dashboard}
        sources={sources}
      />
    </main>
  );
}
