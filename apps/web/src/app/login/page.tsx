"use client";

import { Button, controlClass, Field } from "@/components/ui";
import { api } from "@/lib/api";
import { useSession } from "@/lib/store";
import type { SessionUser, Workspace } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

const demos = [
  ["Alex Chen · Admin", "alex.chen@northwind.example"],
  ["Mina Patel · Manager", "mina.patel@northwind.example"],
  ["Sam Lee · Member", "sam.lee@northwind.example"],
];

export default function LoginPage() {
  const setSession = useSession((state) => state.setSession);
  const router = useRouter();
  const [email, setEmail] = useState("alex.chen@northwind.example");
  const [password, setPassword] = useState("Northwind#2026");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const body = await api<{ mfaRequired?: boolean; accessToken?: string; user: SessionUser; workspace: Workspace }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, mfaCode: mfaCode || undefined }),
      });
      if (body.mfaRequired) {
        setMfaRequired(true);
        return;
      }
      setSession({ accessToken: body.accessToken!, user: body.user, workspace: body.workspace });
      router.replace("/cards");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#f4f6f9] px-4">
      <form onSubmit={submit} className="w-full max-w-[420px] rounded-3xl bg-white p-8 shadow-card">
        <div className="mb-8 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#1aa3e8] text-xs font-bold text-white">NC</span>
          <span className="text-lg font-bold tracking-wide text-[#1aa3e8]">NAMECARD</span>
        </div>
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-[#8b919a]">Use your workspace account to open cards, scans, and contacts.</p>
        <div className="mt-6 space-y-4">
          <Field label="Email">
            <input className={controlClass} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" />
          </Field>
          <Field label="Password">
            <input className={controlClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          </Field>
          {mfaRequired ? (
            <Field label="Authenticator code">
              <input className={controlClass} value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} inputMode="numeric" />
            </Field>
          ) : null}
        </div>
        {error ? <p className="mt-3 text-sm text-[#d14343]">{error}</p> : null}
        <Button className="mt-6 w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
        <div className="mt-6 space-y-2">
          {demos.map(([label, value]) => (
            <button type="button" key={value} className="block w-full rounded-xl bg-[#f6f7f9] px-3 py-2 text-left text-sm text-[#3d4550]" onClick={() => { setEmail(value); setPassword("Northwind#2026"); }}>
              {label}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
