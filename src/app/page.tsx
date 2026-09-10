import Link from "next/link";
import { count } from "drizzle-orm";
import { db } from "@/lib/db";
import { regions, sources } from "@/lib/db/schema";
import { CheckForm } from "./check-form";

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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-5 py-10">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
          Amana Check
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Check before you share.
        </h1>
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Paste a rumor, forwarded message, or question in any language. Amana
          answers with what is actually known — sourced, dated, and actionable —
          and says plainly when it cannot tell.
        </p>
      </header>

      <CheckForm />

      <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-5 text-sm dark:border-zinc-800">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
          How Amana decides
        </h2>
        <ul className="flex flex-col gap-2 text-zinc-600 dark:text-zinc-400">
          <li>
            Sources are tiered: official primary, then independent fact-checkers
            and humanitarian organisations, then credible media.
          </li>
          <li>
            Every answer lists its evidence and when it was last checked.
            &ldquo;Unknown&rdquo; is a valid answer, and absence of evidence is
            never treated as proof of safety.
          </li>
          <li>
            When sources are older than the freshness window for that kind of
            claim, Amana refuses a verdict instead of guessing.
          </li>
        </ul>
        <Link
          href="/methodology"
          className="font-medium text-sky-700 underline dark:text-sky-400"
        >
          Read the full method
        </Link>
      </section>

      <footer className="flex flex-col gap-1 text-xs text-zinc-500">
        {counts ? (
          <p>
            {counts.regions} regions and {counts.sources} sources registered
            across Nigeria and Kenya.
          </p>
        ) : null}
        <p>
          Checks are stored without your identity. Amana never stores raw IP
          addresses and never shares what one person asked.
        </p>
      </footer>
    </main>
  );
}
