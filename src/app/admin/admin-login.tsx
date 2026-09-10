"use client";

import { useState, type FormEvent } from "react";

export function AdminLogin() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passcode) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (!response.ok) {
        setError(
          response.status === 429
            ? "Too many attempts. Try again later."
            : "Incorrect passcode.",
        );
        return;
      }
      window.location.replace("/admin");
    } catch {
      setError("Could not sign in. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label htmlFor="passcode" className="text-sm font-semibold text-ink">
        Admin passcode
      </label>
      <input
        id="passcode"
        type="password"
        value={passcode}
        onChange={(event) => setPasscode(event.target.value)}
        autoComplete="current-password"
        className="h-12 rounded-xl border border-line bg-background px-4 text-base text-ink transition-colors outline-none focus:border-brand"
      />
      <button
        type="submit"
        disabled={sending || passcode.length === 0}
        className="h-12 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-[#095343] disabled:opacity-50"
      >
        {sending ? "Signing in…" : "Sign in"}
      </button>
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </form>
  );
}
