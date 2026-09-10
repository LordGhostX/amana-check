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
      window.location.reload();
    } catch {
      setError("Could not sign in. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-sm flex-col gap-3">
      <label
        htmlFor="passcode"
        className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
      >
        Admin passcode
      </label>
      <input
        id="passcode"
        type="password"
        value={passcode}
        onChange={(event) => setPasscode(event.target.value)}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      />
      <button
        type="submit"
        disabled={sending || passcode.length === 0}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {sending ? "Signing in…" : "Sign in"}
      </button>
      {error ? (
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
      ) : null}
    </form>
  );
}
