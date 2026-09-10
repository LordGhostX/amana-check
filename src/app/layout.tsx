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
  title: "Amana Check — Check before you share",
  description:
    "A community-facing trust layer: sourced, dated, actionable answers to rumors and questions in fragile information environments.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="border-b border-zinc-200 dark:border-zinc-800">
          <nav className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 py-3 text-sm">
            <Link
              href="/"
              className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
            >
              Amana Check
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/methodology"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Method
              </Link>
              <Link
                href="/help"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Get help
              </Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
