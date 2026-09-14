import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { referrals } from "@/lib/db/schema";
import { withUtmSource } from "@/lib/links";

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
    <main className="flex-1">
      <section className="page-grid border-b border-line">
        <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-strong"
          >
            <span aria-hidden="true">←</span> Back to checking
          </Link>
          <div className="mt-8 grid gap-6 md:grid-cols-[1fr_0.75fr] md:items-end">
            <div>
              <p className="font-mono text-xs tracking-[0.16em] text-brand-strong uppercase">
                Trusted contacts
              </p>
              <h1 className="balance mt-3 text-4xl leading-tight font-semibold tracking-tighter text-ink sm:text-6xl">
                Phone and web contacts for Nigeria and Kenya.
              </h1>
            </div>
            <p className="pretty text-base leading-7 text-muted sm:text-lg">
              Amana may include these contact pathways in an answer. A verified
              date means the number was checked against the organisation&apos;s
              own page on that date.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-5 py-12 sm:px-8 sm:py-16">
        {countries.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">
            No contact pathways are available yet.
          </p>
        ) : null}

        {countries.map((country) => (
          <section key={country}>
            <div className="mb-5 flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-brand-soft font-mono text-xs font-semibold text-brand-strong">
                {country}
              </span>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-ink">
                {COUNTRY_NAMES[country] ?? country}
              </h2>
            </div>
            <ul className="grid gap-4 md:grid-cols-2">
              {rows
                .filter((row) => row.country === country)
                .map((row) => {
                  const tel = phoneHref(row.phone);
                  return (
                    <li
                      key={row.id}
                      className="flex min-h-48 flex-col rounded-2xl border border-line bg-surface p-5 text-sm shadow-[0_18px_45px_-38px_rgb(var(--panel-rgb)/0.24)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <span className="text-base font-semibold text-ink">
                          {row.name}
                        </span>
                        <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-muted">
                          {row.category}
                        </span>
                      </div>
                      <div className="mt-2">
                        {row.verifiedAt ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <span aria-hidden="true">✓</span> Verified{" "}
                            {new Date(row.verifiedAt).toLocaleDateString(
                              "en-GB",
                            )}
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-amber-700">
                            Not yet independently verified; confirm locally
                          </span>
                        )}
                      </div>
                      <div className="mt-auto pt-5">
                        {tel ? (
                          <a
                            href={tel}
                            className="font-mono text-lg font-semibold text-ink underline decoration-brand/30 underline-offset-4"
                          >
                            {row.phone}
                          </a>
                        ) : (
                          <p className="font-mono text-lg font-semibold text-ink">
                            {row.phone}
                          </p>
                        )}
                        {row.description ? (
                          <p className="mt-2 leading-6 text-muted">
                            {row.description}
                          </p>
                        ) : null}
                        {row.url ? (
                          <a
                            href={withUtmSource(row.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-flex items-center gap-1 font-semibold text-brand-strong underline decoration-brand/30 underline-offset-4"
                          >
                            Official page <span aria-hidden="true">↗</span>
                          </a>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
