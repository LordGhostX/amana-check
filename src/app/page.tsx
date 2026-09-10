import { count } from "drizzle-orm";
import { db } from "@/lib/db";
import { regions, sources } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

async function loadRegistryCounts() {
  try {
    const [regionRow] = await db.select({ value: count() }).from(regions);
    const [sourceRow] = await db.select({ value: count() }).from(sources);
    return {
      regions: regionRow?.value ?? 0,
      sources: sourceRow?.value ?? 0,
    };
  } catch {
    return null;
  }
}

export default async function Home() {
  const counts = await loadRegistryCounts();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-5 py-14">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
          Amana Check
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Check before you share.
        </h1>
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          A community-facing trust layer for fragile information environments.
          Paste a message, claim, or question. Amana answers with what is
          actually known — sourced, dated, and actionable — in your language.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <button
          type="button"
          disabled
          className="flex h-14 w-full items-center justify-center rounded-xl bg-zinc-900 text-base font-medium text-white opacity-60 dark:bg-zinc-50 dark:text-zinc-900"
        >
          Check a message
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled
            className="flex h-12 items-center justify-center rounded-xl border border-zinc-200 text-sm font-medium text-zinc-700 opacity-60 dark:border-zinc-800 dark:text-zinc-300"
          >
            Ask a question
          </button>
          <button
            type="button"
            disabled
            className="flex h-12 items-center justify-center rounded-xl border border-zinc-200 text-sm font-medium text-zinc-700 opacity-60 dark:border-zinc-800 dark:text-zinc-300"
          >
            Get help now
          </button>
        </div>
        <p className="text-sm text-zinc-500">
          The check interface ships in Phase 3. The trust engine and data layer
          are being built now.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-5 text-sm dark:border-zinc-800">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
          Foundation status
        </h2>
        {counts ? (
          <ul className="flex flex-col gap-1 text-zinc-600 dark:text-zinc-400">
            <li>{counts.regions} regions registered (Nigeria + Kenya)</li>
            <li>{counts.sources} sources registered</li>
            <li>Fail-closed AI routing: ZDR + no-training providers only</li>
            <li>Every input de-identified and unlinked from identifiers</li>
          </ul>
        ) : (
          <p className="text-zinc-500">
            Database not reachable. Copy <code>.env.example</code> to{" "}
            <code>.env</code> and run <code>bun run db:migrate</code> then{" "}
            <code>bun run db:seed</code>.
          </p>
        )}
      </section>
    </main>
  );
}
