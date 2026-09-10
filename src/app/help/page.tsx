import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { referrals } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Get help: Amana Check",
  description:
    "Verified and clearly-labelled contact pathways for Nigeria and Kenya.",
};

const COUNTRY_NAMES: Record<string, string> = {
  NG: "Nigeria",
  KE: "Kenya",
};

const SINGLE_NUMBER_RE = /^\+?[\d\s()-]+$/;

function phoneHref(phone: string | null): string | null {
  if (!phone) return null;
  if (!SINGLE_NUMBER_RE.test(phone) || phone.includes("/")) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.length >= 3 ? `tel:${digits}` : null;
}

export default async function HelpPage() {
  const rows = await db
    .select()
    .from(referrals)
    .orderBy(referrals.country, referrals.category, referrals.id);

  const countries = Array.from(new Set(rows.map((row) => row.country)));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-5 py-10">
      <header className="flex flex-col gap-3">
        <Link href="/" className="text-sm text-zinc-500 underline">
          ← Back to checking
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Get help
        </h1>
        <p className="text-base leading-7 text-zinc-600 dark:text-zinc-400">
          Contact pathways Amana Check may include in answers. Numbers marked
          verified were confirmed against the organisation&apos;s own page on
          the date shown. Anything else must be confirmed locally before you
          rely on it.
        </p>
      </header>

      {countries.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No contact pathways have been seeded yet. Run{" "}
          <code>bun run db:seed</code>.
        </p>
      ) : null}

      {countries.map((country) => (
        <section key={country} className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {COUNTRY_NAMES[country] ?? country}
          </h2>
          <ul className="flex flex-col gap-3">
            {rows
              .filter((row) => row.country === country)
              .map((row) => {
                const tel = phoneHref(row.phone);
                return (
                  <li
                    key={row.id}
                    className="flex flex-col gap-1 rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {row.name}
                      </span>
                      <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                        {row.category}
                      </span>
                      {row.verifiedAt ? (
                        <span className="text-xs text-emerald-700 dark:text-emerald-400">
                          Verified{" "}
                          {new Date(row.verifiedAt).toLocaleDateString("en-GB")}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700 dark:text-amber-400">
                          Not yet independently verified; confirm locally
                        </span>
                      )}
                    </div>
                    {tel ? (
                      <a
                        href={tel}
                        className="font-mono text-base text-zinc-900 underline decoration-zinc-300 underline-offset-4 dark:text-zinc-100 dark:decoration-zinc-700"
                      >
                        {row.phone}
                      </a>
                    ) : (
                      <p className="font-mono text-base text-zinc-900 dark:text-zinc-100">
                        {row.phone}
                      </p>
                    )}
                    {row.description ? (
                      <p className="text-zinc-600 dark:text-zinc-400">
                        {row.description}
                      </p>
                    ) : null}
                    {row.url ? (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-700 underline dark:text-sky-400"
                      >
                        Official page
                      </a>
                    ) : null}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </main>
  );
}
