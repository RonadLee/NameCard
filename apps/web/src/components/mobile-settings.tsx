"use client";

import { api } from "@/lib/api";
import { useSession } from "@/lib/store";
import type { SessionUser, Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Crown } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

type Section = "account" | "general" | "language" | "notifications" | "privacy" | "permissions" | "plan" | "help" | "recommend";

const rows: { id: Section; label: string }[] = [
  { id: "account", label: "Account and Sync" },
  { id: "general", label: "General" },
  { id: "language", label: "Language setting" },
  { id: "notifications", label: "Notifications" },
  { id: "privacy", label: "Privacy Settings" },
  { id: "permissions", label: "System permissions" },
];

export function MobileSettings() {
  const params = useSearchParams();
  const user = useSession((state) => state.user);
  const workspace = useSession((state) => state.workspace);
  const [section, setSection] = useState<Section | null>(params.get("tab") === "billing" ? "plan" : null);
  const org = useQuery({
    queryKey: ["org"],
    queryFn: () => api<{ workspace: Workspace }>("/org"),
    staleTime: 15_000,
  });
  const plan = org.data?.workspace.plan ?? workspace?.plan ?? "PERSONAL";
  const team = plan === "TEAM";

  if (section) {
    return (
      <div className="min-h-full bg-[#f3f5f8]">
        <header className="flex items-center gap-2 px-2 py-3">
          <button type="button" aria-label="Back" className="grid h-9 w-9 place-items-center" onClick={() => setSection(null)}><ChevronLeft /></button>
          <h1 className="text-base font-semibold">{rows.find((row) => row.id === section)?.label || title(section)}</h1>
        </header>
        <div className="px-4 pb-8">
          {section === "account" ? <Account user={user} /> : null}
          {section === "general" ? <General /> : null}
          {section === "language" ? <p className="rounded-2xl bg-white p-4 text-sm">English is the language used throughout NameCard.</p> : null}
          {section === "notifications" ? <Notifications /> : null}
          {section === "privacy" ? <Privacy user={user} /> : null}
          {section === "permissions" ? <Permissions /> : null}
          {section === "plan" ? <Plan current={plan} /> : null}
          {section === "help" ? <Help /> : null}
          {section === "recommend" ? <Recommend /> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 pt-4">
      <h1 className="text-[28px] font-semibold">Settings</h1>
      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#e7eef6] text-lg font-semibold text-[#5c6b7a]">{(user?.name || "N").slice(0, 1)}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">{user?.email}</div>
        </div>
        {team ? <Crown size={18} className="text-[#e2b657]" /> : null}
      </div>
      <button type="button" className="mt-3 w-full rounded-2xl bg-[#f8efd2] p-4 text-left" onClick={() => setSection("plan")}>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 font-semibold"><Crown size={16} className="text-[#e2b657]" /> {team ? "Team" : "Personal"}</span>
          <span className="text-xs text-[#8a6a22]">{workspace?.name} ›</span>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[11px] text-[#6d5a2e]">
          <span>Card scan</span>
          <span>Feishu sync</span>
          <span>Export</span>
          <span>Storage</span>
        </div>
      </button>
      <p className="mb-2 mt-6 text-xs font-medium tracking-wide text-[#98a1ab]">APP SETTINGS</p>
      <div className="overflow-hidden rounded-2xl bg-white">
        {rows.map((row) => (
          <button key={row.id} type="button" className="flex w-full items-center border-b border-[#f4f6f9] px-4 py-4 text-left text-sm last:border-b-0" onClick={() => setSection(row.id)}>
            <span className="flex-1">{row.label}</span>
            <ChevronRight size={16} className="text-[#c5ccd4]" />
          </button>
        ))}
      </div>
      <button type="button" className="mt-3 flex w-full items-center rounded-2xl bg-white px-4 py-4 text-left text-sm" onClick={() => setSection("plan")}>
        <span className="flex-1">Resume In-App Purchases</span>
        <ChevronRight size={16} className="text-[#c5ccd4]" />
      </button>
      <p className="mb-2 mt-6 text-sm text-[#66707c]">Help and Feedback</p>
      <div className="overflow-hidden rounded-2xl bg-white">
        <button type="button" className="flex w-full items-center border-b border-[#f4f6f9] px-4 py-4 text-sm" onClick={() => setSection("help")}><span className="flex-1 text-left">Help and Feedback</span><ChevronRight size={16} className="text-[#c5ccd4]" /></button>
        <button type="button" className="flex w-full items-center px-4 py-4 text-sm" onClick={() => setSection("recommend")}><span className="flex-1 text-left">Recommend to Friends</span><ChevronRight size={16} className="text-[#c5ccd4]" /></button>
      </div>
    </div>
  );
}

function title(section: Section) {
  if (section === "plan") return "Plan";
  if (section === "help") return "Help and Feedback";
  return "Recommend to Friends";
}

function Account({ user }: { user: SessionUser | null }) {
  const toast = useSession((state) => state.toast);
  const token = useSession((state) => state.accessToken);
  const workspace = useSession((state) => state.workspace);
  const setSession = useSession((state) => state.setSession);
  const status = useQuery({ queryKey: ["integrations"], queryFn: () => api<{ storage?: boolean; identity?: boolean }>("/integrations/status") });
  const [form, setForm] = useState({ name: user?.name ?? "", nameZh: user?.nameZh ?? "", title: user?.title ?? "", phone: user?.phone ?? "" });
  const [openId, setOpenId] = useState(user?.feishuOpenId ?? "");
  const [unionId, setUnionId] = useState(user?.feishuUnionId ?? "");
  return (
    <div className="space-y-3">
      <p className="text-sm text-[#66707c]">{user?.email}</p>
      {(["name", "nameZh", "title", "phone"] as const).map((key) => (
        <input key={key} className="h-11 w-full rounded-xl border border-[#e6e9ef] bg-white px-3 text-sm outline-none" aria-label={key} value={form[key] || ""} onChange={(event) => setForm({ ...form, [key]: event.target.value })} placeholder={key} />
      ))}
      <button type="button" className="h-11 w-full rounded-full bg-[#1a9fff] text-sm font-medium text-white" onClick={async () => {
        try {
          const next = await api<{ user: SessionUser; workspace: Workspace }>("/auth/profile", { method: "PATCH", body: JSON.stringify(form) });
          if (token) setSession({ accessToken: token, user: next.user, workspace: next.workspace });
          toast("Profile saved");
        } catch (error) {
          toast(error instanceof Error ? error.message : "Could not save profile", "err");
        }
      }}>Save profile</button>
      <div className="rounded-2xl bg-white p-4 text-sm">
        <p>Feishu identity: {status.data?.identity ? "Configured" : "Not configured"}</p>
        <p className="mt-1">Feishu storage: {status.data?.storage ? "Connected" : "Local storage"}</p>
        <input className="mt-3 h-10 w-full rounded-xl border border-[#e6e9ef] px-3" placeholder="Feishu open_id" value={openId} onChange={(event) => setOpenId(event.target.value)} />
        <input className="mt-2 h-10 w-full rounded-xl border border-[#e6e9ef] px-3" placeholder="Feishu union_id" value={unionId} onChange={(event) => setUnionId(event.target.value)} />
        <button type="button" className="mt-3 text-[#1a9fff]" onClick={async () => {
          await api("/integrations/feishu/mapping", { method: "POST", body: JSON.stringify({ openId, unionId }) });
          if (token && user && workspace) setSession({ accessToken: token, user: { ...user, feishuOpenId: openId, feishuUnionId: unionId }, workspace });
          toast("Feishu mapping saved");
        }}>Save Feishu mapping</button>
      </div>
    </div>
  );
}

function General() {
  const user = useSession((state) => state.user);
  const workspace = useSession((state) => state.workspace);
  const setSession = useSession((state) => state.setSession);
  const toast = useSession((state) => state.toast);
  const queryClient = useQueryClient();
  return (
    <div className="rounded-2xl bg-white p-4 text-sm">
      <p className="text-[#66707c]">Workspace</p>
      <p className="mt-1 font-medium">{workspace?.name}</p>
      {(user?.memberships.length ?? 0) > 1 ? (
        <select className="mt-3 h-10 w-full rounded-xl border border-[#e6e9ef] px-2" value={workspace?.id ?? ""} aria-label="Workspace" onChange={async (event) => {
          const next = await api<{ accessToken: string; user: SessionUser; workspace: Workspace }>("/auth/switch", { method: "POST", body: JSON.stringify({ workspaceId: event.target.value }) });
          setSession(next);
          queryClient.clear();
          toast(`Switched to ${next.workspace.name}`);
        }}>
          {user?.memberships.map((item) => <option key={item.workspace.id} value={item.workspace.id}>{item.workspace.name}</option>)}
        </select>
      ) : null}
    </div>
  );
}

function Notifications() {
  const [allowed, setAllowed] = useState(typeof Notification !== "undefined" ? Notification.permission : "default");
  return (
    <div className="rounded-2xl bg-white p-4 text-sm">
      <p>Browser notification permission: {allowed}</p>
      <button type="button" className="mt-3 h-10 rounded-full bg-[#1a9fff] px-4 text-white" onClick={async () => {
        if (typeof Notification === "undefined") return;
        setAllowed(await Notification.requestPermission());
      }}>Allow notifications</button>
    </div>
  );
}

function Privacy({ user }: { user: SessionUser | null }) {
  const toast = useSession((state) => state.toast);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<{ secret: string; otpauth: string } | null>(null);
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white p-4">
        <p className="text-sm font-medium">Password</p>
        <input type="password" autoComplete="current-password" className="mt-3 h-10 w-full rounded-xl border border-[#e6e9ef] px-3 text-sm" placeholder="Current password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
        <input type="password" autoComplete="new-password" className="mt-2 h-10 w-full rounded-xl border border-[#e6e9ef] px-3 text-sm" placeholder="New password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} />
        <button type="button" className="mt-3 h-10 rounded-full bg-[#1a9fff] px-4 text-sm text-white" onClick={async () => {
          try {
            await api("/auth/password", { method: "POST", body: JSON.stringify({ currentPassword, nextPassword }) });
            setCurrentPassword("");
            setNextPassword("");
            toast("Password updated");
          } catch (error) {
            toast(error instanceof Error ? error.message : "Could not update password", "err");
          }
        }}>Update password</button>
      </div>
      <div className="rounded-2xl bg-white p-4 text-sm">
        <p>Authenticator: {user?.mfaEnabled ? "On" : "Off"}</p>
        <button type="button" className="mt-3 h-10 rounded-full bg-[#f3f5f8] px-4" onClick={async () => {
          try {
            setSetup(await api("/auth/mfa/setup", { method: "POST" }));
          } catch (error) {
            toast(error instanceof Error ? error.message : "Could not start MFA", "err");
          }
        }}>Set up authenticator</button>
        {setup ? <p className="mt-3 break-all text-xs text-[#66707c]">{setup.secret}</p> : null}
        <div className="mt-3 flex gap-2">
          <input className="h-10 min-w-0 flex-1 rounded-xl border border-[#e6e9ef] px-3" placeholder="6-digit code" value={code} onChange={(event) => setCode(event.target.value)} />
          <button type="button" className="h-10 rounded-xl bg-[#1a9fff] px-3 text-white" onClick={async () => {
            try {
              await api("/auth/mfa/enable", { method: "POST", body: JSON.stringify({ code }) });
              toast("MFA enabled");
            } catch (error) {
              toast(error instanceof Error ? error.message : "Could not enable MFA", "err");
            }
          }}>Enable</button>
        </div>
      </div>
    </div>
  );
}

function Permissions() {
  const [camera, setCamera] = useState("unknown");
  return (
    <div className="rounded-2xl bg-white p-4 text-sm">
      <p>Camera: {camera}</p>
      <button type="button" className="mt-3 h-10 rounded-full bg-[#1a9fff] px-4 text-white" onClick={async () => {
        try {
          const status = await navigator.permissions.query({ name: "camera" as PermissionName });
          setCamera(status.state);
        } catch {
          setCamera("Ask when scanning");
        }
      }}>Check camera</button>
    </div>
  );
}

function Plan({ current }: { current: string }) {
  const toast = useSession((state) => state.toast);
  const token = useSession((state) => state.accessToken);
  const user = useSession((state) => state.user);
  const setSession = useSession((state) => state.setSession);
  const queryClient = useQueryClient();
  return (
    <div className="grid gap-3">
      <p className="text-sm text-[#66707c]">This reloads the workspace plan already stored for the account. It does not start a new charge.</p>
      {(["PERSONAL", "TEAM"] as const).map((plan) => (
        <button key={plan} type="button" className={cn("rounded-2xl bg-white p-4 text-left", current === plan && "ring-2 ring-[#1a9fff]")} onClick={async () => {
          const next = await api<Workspace>("/workspace/plan", { method: "PATCH", body: JSON.stringify({ plan }) });
          if (token && user) setSession({ accessToken: token, user, workspace: next });
          await queryClient.invalidateQueries({ queryKey: ["org"] });
          toast(`${plan === "TEAM" ? "Team" : "Personal"} plan is active`);
        }}>
          <div className="font-medium">{plan === "TEAM" ? "Team" : "Personal"}</div>
          <div className="mt-1 text-xs text-[#8b919a]">{current === plan ? "Current plan" : "Switch"}</div>
        </button>
      ))}
    </div>
  );
}

function Help() {
  return <p className="rounded-2xl bg-white p-4 text-sm leading-6">NameCard keeps cards, signatures, virtual backgrounds, and the cardholder in this workspace. Scanning uses the same recognition pipeline as the desktop scanner.</p>;
}

function Recommend() {
  const toast = useSession((state) => state.toast);
  return (
    <button type="button" className="h-11 w-full rounded-full bg-[#1a9fff] text-sm font-medium text-white" onClick={async () => {
      const url = window.location.origin;
      if (navigator.share) {
        await navigator.share({ title: "NameCard", url }).catch(() => undefined);
        return;
      }
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    }}>Share NameCard</button>
  );
}
