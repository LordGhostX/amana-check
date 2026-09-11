import Link from "next/link";
import { count, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { regions, sources } from "@/lib/db/schema";
import { CheckForm } from "./check-form";

export const dynamic = "force-dynamic";

async function loadRegistryCounts() {
  try {
    const [regionRow] = await db.select({ value: count() }).from(regions);
    const [sourceRow] = await db
      .select({
        total: count(),
        enabled:
          sql<number>`count(*) filter (where ${sources.enabled})`.mapWith(
            Number,
          ),
      })
      .from(sources);
    return {
      regions: regionRow?.value ?? 0,
      sources: sourceRow?.total ?? 0,
      sourcesEnabled: sourceRow?.enabled ?? 0,
    };
  } catch {
    return null;
  }
}

export default async function Home() {
  const counts = await loadRegistryCounts();

  return (
    <main className="flex-1">
      <section className="page-grid border-b border-line">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:gap-16 lg:py-20">
          <header className="flex flex-col items-start lg:sticky lg:top-28">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft px-3 py-1.5 text-sm font-semibold text-brand-strong">
              <span
                className="size-2 rounded-full bg-accent shadow-[0_0_0_3px_rgba(217,247,95,0.12)]"
                aria-hidden="true"
              />
              Checking Nigeria and Kenya
            </div>
            <h1 className="hero-title w-full max-w-none text-4xl leading-[0.98] font-semibold tracking-[-0.065em] text-ink lg:max-w-xl lg:text-[clamp(3rem,7vw,5.8rem)] lg:leading-[0.94]">
              Before you forward it, check it.
            </h1>
            <p className="pretty mt-7 max-w-lg text-lg leading-8 text-muted sm:text-xl">
              Paste a rumor, voice-note transcript, or forwarded message in any
              language. Amana checks dated sources and explains what they
              support. If the evidence is missing, it says so.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-ink">
              <span className="flex items-center gap-2">
                <span className="text-brand-strong" aria-hidden="true">
                  ✓
                </span>
                Answers in your language
              </span>
              <span className="flex items-center gap-2">
                <span className="text-brand-strong" aria-hidden="true">
                  ✓
                </span>
                Sources and dates included
              </span>
            </div>
          </header>

          <CheckForm />
        </div>
      </section>

      <section className="bg-panel text-white">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-10 sm:px-8 md:grid-cols-[0.7fr_1.3fr] md:items-center md:py-12">
          <div>
            <p className="font-mono text-xs tracking-[0.18em] text-accent uppercase">
              When sources are silent
            </p>
            <h2 className="balance mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
              A missing source is never treated as proof that a rumor is safe.
            </h2>
          </div>
          <ol className="grid gap-4 sm:grid-cols-3">
            {[
              [
                "01",
                "Understand",
                "Amana detects the language, place, and type of claim.",
              ],
              [
                "02",
                "Check",
                "It searches a maintained set of official and independent sources.",
              ],
              [
                "03",
                "Explain",
                "You get a dated answer with clear limits and next steps.",
              ],
            ].map(([number, title, description]) => (
              <li key={number} className="border-l border-white/20 pl-4">
                <span className="font-mono text-xs text-accent">{number}</span>
                <h3 className="mt-2 font-semibold text-white">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-white/65">
                  {description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-12 sm:px-8 md:grid-cols-[1fr_auto] md:items-end md:py-16">
        <div>
          <p className="font-mono text-xs tracking-[0.18em] text-brand-strong uppercase">
            Source rules
          </p>
          <h2 className="balance mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-ink sm:text-4xl">
            Every answer starts with dated evidence. If the sources cannot
            support a verdict, Amana says &quot;unknown&quot;
          </h2>
          <Link
            href="/methodology"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand-strong"
          >
            Read the full methodology <span aria-hidden="true">→</span>
          </Link>
        </div>
        {counts ? (
          <dl className="grid grid-cols-2 gap-3">
            <div className="min-w-32 rounded-2xl border border-line bg-surface p-5">
              <dt className="text-sm text-muted">Regions covered</dt>
              <dd className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-ink">
                {counts.regions}
              </dd>
            </div>
            <div className="min-w-32 rounded-2xl border border-line bg-surface p-5">
              <dt className="text-sm text-muted">Active sources</dt>
              <dd className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-ink">
                {counts.sourcesEnabled}
              </dd>
            </div>
          </dl>
        ) : null}
      </section>
    </main>
  );
}
