import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Amana Check: Check before you share",
  description:
    "Check rumors, forwarded messages, and public claims against dated, trusted sources for Nigeria and Kenya.",
};

function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="grid size-9 place-items-center rounded-xl bg-brand text-sm font-bold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]"
    >
      A
    </span>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-50 border-b border-line/80 bg-background/90 backdrop-blur-xl">
          <nav className="mx-auto flex h-18 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
            <Link
              href="/"
              className="group flex shrink-0 items-center gap-2 font-semibold tracking-[-0.02em] whitespace-nowrap text-ink sm:gap-3"
              aria-label="Amana Check home"
            >
              <BrandMark />
              <span className="text-base sm:text-[1.05rem]">Amana Check</span>
            </Link>
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <Link
                href="/methodology"
                className="hidden rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap text-muted transition-colors hover:bg-surface-muted hover:text-ink sm:inline-flex sm:px-4"
              >
                How it works
              </Link>
              <Link
                href="/help"
                className="rounded-full bg-panel px-3.5 py-2 text-sm font-semibold whitespace-nowrap text-white transition-transform hover:-translate-y-0.5 sm:px-4"
              >
                Get help
              </Link>
            </div>
          </nav>
        </header>
        {children}
        <footer className="mt-auto border-t border-line bg-surface">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div className="flex items-center gap-2">
              <BrandMark />
              <p>Answers include sources and the date checked.</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <Link href="/methodology" className="hover:text-ink">
                How it works
              </Link>
              <Link href="/help" className="hover:text-ink">
                Help contacts
              </Link>
              <Link href="/admin" className="hover:text-ink">
                Review console
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
