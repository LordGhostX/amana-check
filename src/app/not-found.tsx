import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found: Amana Check",
  description: "The Amana Check page you requested could not be found.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="page-grid flex flex-1 items-center border-b border-line">
      <section className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="max-w-2xl">
          <p className="font-mono text-xs tracking-[0.16em] text-brand-strong uppercase">
            404 / Page not found
          </p>
          <h1 className="balance mt-4 text-4xl leading-[1.05] font-semibold tracking-tighter text-ink sm:text-6xl">
            That page isn&apos;t here.
          </h1>
          <p className="pretty mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg">
            The link may be old or typed differently. Go back to checking or
            read how Amana works.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
            >
              Back to checking <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/methodology"
              className="inline-flex items-center rounded-full border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-muted"
            >
              How it works
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
