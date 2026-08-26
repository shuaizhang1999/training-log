"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.replace("/");
        return;
      }
      setError(true);
      setPassword("");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 pb-safe pt-safe">
      <div className={error ? "animate-shake" : ""}>
        <div className="mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-accent font-display text-2xl font-bold text-accent">
            TL
          </div>
          <h1 className="mt-4 font-display text-4xl font-bold uppercase leading-none tracking-wide">
            Training
            <br />
            Log
          </h1>
          <div className="hazard mt-3 h-[3px] w-24 rounded-full opacity-80" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            autoFocus
            className={`h-14 w-full rounded-xl border bg-surface2 px-4 text-lg text-ink placeholder:text-dim/60 focus:outline-none ${
              error ? "border-hard" : "border-line focus:border-accent"
            }`}
          />
          <button
            type="submit"
            disabled={busy || !password}
            className="h-14 w-full rounded-xl bg-accent font-display text-base font-bold uppercase tracking-[0.18em] text-black transition-all active:enabled:scale-[0.98] disabled:opacity-40"
          >
            {busy ? "Checking…" : "Unlock"}
          </button>
          {error && (
            <p className="font-mono text-sm text-hard">Wrong password — try again.</p>
          )}
        </form>
      </div>
    </main>
  );
}
