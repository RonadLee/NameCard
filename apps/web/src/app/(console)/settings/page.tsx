"use client";

import { Button, controlClass, Field, PageTitle } from "@/components/ui";
import { api } from "@/lib/api";
import { useSession } from "@/lib/store";
import type { Workspace } from "@/lib/types";
import { bytesLabel, cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

const tabs = ["profile", "members", "security", "audit", "billing", "feishu", "storage"] as const;

type Org = {
  workspace: Workspace;
  members: { user: { id: string; name: string; email: string; mfaEnabled: boolean; feishuOpenId?: string | null }; role: string }[];
  departments: { id: string; name: string }[];
  approvals: { id: string; type: string; status: string; requester: { name: string } }[];
  audits: { id: string; action: string; entity: string; createdAt: string; actor: { name: string } | null }[];
};

function SettingsBody() {
  const params = useSearchParams();
  const initial = tabs.includes(params.get("tab") as (typeof tabs)[number]) ? (params.get("tab") as (typeof tabs)[number]) : "profile";
  const [tab, setTab] = useState<(typeof tabs)[number]>(initial);
  const user = useSession((state) => state.user);
  const workspace = useSession((state) => state.workspace);
  const setSession = useSession((state) => state.setSession);
  const token = useSession((state) => state.accessToken);
  const toast = useSession((state) => state.toast);
  const queryClient = useQueryClient();
  const org = useQuery({ queryKey: ["org"], queryFn: () => api<Org>("/org") });
  const status = useQuery({ queryKey: ["integrations"], queryFn: () => api<Record<string, unknown>>("/integrations/status") });
  const current = org.data?.workspace ?? workspace;

  async function refreshSession(nextWorkspace?: Workspace) {
    if (!token || !user || !nextWorkspace) return;
    setSession({ accessToken: token, user, workspace: nextWorkspace });
    await queryClient.invalidateQueries({ queryKey: ["org"] });
  }

  return (
    <div>
      <PageTitle title="Settings" />
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((item) => <button key={item} className={cn("rounded-full px-3 py-1.5 text-sm capitalize", tab === item ? "bg-[#1aa3e8] text-white" : "bg-white")} onClick={() => setTab(item)}>{item}</button>)}
      </div>
      {tab === "profile" ? (
        <section className="rounded-2xl bg-white p-5 shadow-card text-sm">
          <div className="text-lg font-semibold">{user?.name}</div>
          <p className="text-[#66707c]">{user?.email}</p>
          <p className="mt-2">Chinese name: {user?.nameZh || "—"}</p>
          <p>Title: {user?.title || "—"}</p>
          <p>Feishu open id: {user?.feishuOpenId || "Not mapped"}</p>
        </section>
      ) : null}
      {tab === "members" ? <Members org={org.data} /> : null}
      {tab === "security" ? <Security /> : null}
      {tab === "audit" ? (
        <section className="rounded-2xl bg-white p-5 shadow-card">
          <ul className="divide-y divide-[#f4f6f9] text-sm">
            {(org.data?.audits ?? []).map((item) => <li key={item.id} className="py-2">{item.actor?.name ?? "System"} · {item.action} · {item.entity}</li>)}
          </ul>
        </section>
      ) : null}
      {tab === "billing" ? (
        <section className="grid gap-3 md:grid-cols-2">
          {(["PERSONAL", "TEAM"] as const).map((plan) => (
            <div key={plan} className={cn("rounded-2xl bg-white p-5 shadow-card", current?.plan === plan && "ring-2 ring-[#1aa3e8]")}>
              <div className="text-lg font-semibold">{plan === "TEAM" ? "Team" : "Personal"}</div>
              <p className="mt-2 text-sm text-[#66707c]">{plan === "TEAM" ? "Shared templates, departments, and a larger storage pool." : "One workspace with your own cards and cardholder."}</p>
              <Button className="mt-4" variant={current?.plan === plan ? "soft" : "primary"} onClick={async () => {
                const next = await api<Workspace>("/workspace/plan", { method: "PATCH", body: JSON.stringify({ plan }) });
                await refreshSession(next);
                toast(`${plan === "TEAM" ? "Team" : "Personal"} plan is active`);
              }}>{current?.plan === plan ? "Current plan" : "Switch"}</Button>
            </div>
          ))}
        </section>
      ) : null}
      {tab === "feishu" ? <Feishu status={status.data} onDone={() => { toast("Feishu mapping saved"); void queryClient.invalidateQueries({ queryKey: ["org"] }); }} /> : null}
      {tab === "storage" && current ? (
        <section className="rounded-2xl bg-white p-5 shadow-card">
          <div className="text-sm text-[#66707c]">{bytesLabel(current.storageUsedBytes)} of {bytesLabel(current.storageLimitBytes)}</div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eef2f6]"><div className="h-full bg-[#1aa3e8]" style={{ width: `${Math.min(100, (current.storageUsedBytes / current.storageLimitBytes) * 100)}%` }} /></div>
        </section>
      ) : null}
      {tab === "audit" ? null : null}
      <Approvals items={org.data?.approvals ?? []} />
    </div>
  );
}

function Members({ org }: { org?: Org }) {
  const toast = useSession((state) => state.toast);
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", role: "USER", departmentId: "" });
  const [password, setPassword] = useState("");
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <ul className="mb-4 divide-y text-sm">{(org?.members ?? []).map((member) => <li key={member.user.id} className="py-2">{member.user.name} · {member.user.email} · {member.role}{member.user.mfaEnabled ? " · MFA" : ""}</li>)}</ul>
      <div className="grid gap-2 md:grid-cols-4">
        <input className={controlClass} placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <input className={controlClass} placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <select className={controlClass} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
          {["USER", "MANAGER", "ADMIN", "SUPER_ADMIN"].map((role) => <option key={role}>{role}</option>)}
        </select>
        <Button onClick={async () => {
          try {
            const result = await api<{ temporaryPassword?: string }>("/members", { method: "POST", body: JSON.stringify(form) });
            setPassword(result.temporaryPassword || "Existing account linked");
            await queryClient.invalidateQueries({ queryKey: ["org"] });
          } catch (error) {
            toast(error instanceof Error ? error.message : "Invite failed", "err");
          }
        }}>Invite</Button>
      </div>
      {password ? <p className="mt-3 text-sm">Temporary password: {password}</p> : null}
    </section>
  );
}

function Security() {
  const toast = useSession((state) => state.toast);
  const [setup, setSetup] = useState<{ otpauth: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <p className="text-sm text-[#66707c]">Add an authenticator so the next sign-in asks for a 6-digit code. The secret is stored encrypted.</p>
      <Button className="mt-3" onClick={async () => setSetup(await api("/auth/mfa/setup", { method: "POST" }))}>Set up authenticator</Button>
      {setup ? <div className="mt-4 text-sm"><div className="break-all">{setup.secret}</div><div className="mt-1 break-all text-[#8b919a]">{setup.otpauth}</div></div> : null}
      <div className="mt-3 flex gap-2">
        <input className={controlClass} placeholder="6-digit code" value={code} onChange={(event) => setCode(event.target.value)} />
        <Button onClick={async () => { await api("/auth/mfa/enable", { method: "POST", body: JSON.stringify({ code }) }); toast("MFA enabled"); }}>Enable</Button>
      </div>
    </section>
  );
}

function Feishu({ status, onDone }: { status?: Record<string, unknown>; onDone: () => void }) {
  const [openId, setOpenId] = useState("");
  const [unionId, setUnionId] = useState("");
  return (
    <section className="space-y-4 rounded-2xl bg-white p-5 shadow-card">
      <p className="text-sm text-[#66707c]">Directory, approval, Bitable, and Open Platform calls use these same endpoints when Feishu credentials are added. Nothing here is a dead screen: sync writes real departments.</p>
      <pre className="overflow-auto rounded-xl bg-[#f6f7f9] p-3 text-xs">{JSON.stringify(status, null, 2)}</pre>
      <Field label="Feishu open_id"><input className={controlClass} value={openId} onChange={(event) => setOpenId(event.target.value)} /></Field>
      <Field label="Feishu union_id"><input className={controlClass} value={unionId} onChange={(event) => setUnionId(event.target.value)} /></Field>
      <div className="flex flex-wrap gap-2">
        <Button onClick={async () => { await api("/integrations/feishu/mapping", { method: "POST", body: JSON.stringify({ openId, unionId }) }); onDone(); }}>Save mapping</Button>
        <Button variant="ghost" onClick={async () => {
          await api("/integrations/feishu/directory/sync", { method: "POST", body: JSON.stringify({ departments: [{ id: "od-hq", name: "Headquarters" }, { id: "od-sales", name: "Sales", parentId: "od-hq" }] }) });
          onDone();
        }}>Sync sample departments</Button>
      </div>
    </section>
  );
}

function Approvals({ items }: { items: Org["approvals"] }) {
  const queryClient = useQueryClient();
  if (!items.length) return null;
  return (
    <section className="mt-4 rounded-2xl bg-white p-5 shadow-card">
      <h2 className="font-medium">Approvals</h2>
      {items.map((item) => (
        <div key={item.id} className="mt-3 flex items-center justify-between text-sm">
          <span>{item.requester.name} · {item.type} · {item.status}</span>
          {item.status === "PENDING" ? (
            <span className="flex gap-2">
              <Button onClick={async () => { await api(`/approvals/${item.id}`, { method: "POST", body: JSON.stringify({ status: "APPROVED" }) }); await queryClient.invalidateQueries({ queryKey: ["org"] }); }}>Approve</Button>
              <Button variant="ghost" onClick={async () => { await api(`/approvals/${item.id}`, { method: "POST", body: JSON.stringify({ status: "REJECTED" }) }); await queryClient.invalidateQueries({ queryKey: ["org"] }); }}>Reject</Button>
            </span>
          ) : null}
        </div>
      ))}
    </section>
  );
}

export default function SettingsPage() {
  return <Suspense fallback={<p className="text-sm text-[#8b919a]">Loading settings…</p>}><SettingsBody /></Suspense>;
}
