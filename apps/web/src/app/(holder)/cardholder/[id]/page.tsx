"use client";

import { MobileDetail } from "@/components/mobile-detail";
import { api } from "@/lib/api";
import { holderHref, holderPageSize, readHolder, type HolderState } from "@/lib/holder";
import { useSession } from "@/lib/store";
import { useWide } from "@/lib/wide";
import type { Contact } from "@/lib/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Copy } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Groups = { groups: { name: string; count: number }[] };
type Page = { items: Contact[]; total: number; page: number; pageSize: number };

export default function CardDetailPage() {
  const wide = useWide();
  if (wide === false) return <MobileDetail />;
  return <DesktopDetail />;
}

function DesktopDetail() {
  const wide = useWide();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = readHolder(searchParams);
  const toast = useSession((s) => s.toast);
  const queryClient = useQueryClient();
  const [q, setQ] = useState(state.q);
  const [menu, setMenu] = useState(false);
  const [showAll, setShowAll] = useState(true);
  const [memo, setMemo] = useState<string | null>(null);
  const [addingGroup, setAddingGroup] = useState("");

  useEffect(() => setQ(state.q), [state.q]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (q !== state.q) router.replace(holderHref({ ...state, q, page: 1 }, params.id));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  const query = new URLSearchParams({ page: String(state.page), pageSize: String(holderPageSize), sort: state.sort, scope: state.scope });
  if (state.group) query.set("group", state.group);
  if (state.q) query.set("q", state.q);
  const cards = useQuery({
    queryKey: ["cardholder", state.scope, state.group, state.sort, state.q, state.page],
    queryFn: () => api<Page>(`/contacts?${query.toString()}`),
    refetchInterval: 4000,
    enabled: wide === true,
  });
  const groups = useQuery({ queryKey: ["contact-groups", state.scope], queryFn: () => api<Groups>(`/contacts/groups?scope=${state.scope}`), refetchInterval: 4000, enabled: wide === true });
  const rows = cards.data?.items ?? [];
  const listed = rows.find((row) => row.id === params.id);
  const fetched = useQuery({
    queryKey: ["contact", params.id],
    queryFn: () => api<Contact>(`/contacts/${params.id}`),
    enabled: wide === true && !cards.isLoading && !listed,
    refetchInterval: 4000,
  });
  const contact = listed ?? fetched.data;
  const title = state.group === "-" ? "Ungrouped" : state.group || "All Cards";
  const total = cards.data?.total ?? rows.length;
  const pages = Math.max(1, Math.ceil(total / holderPageSize));

  function go(partial: Partial<HolderState>, id = params.id) {
    router.replace(holderHref({ ...state, ...partial }, id));
  }

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["cardholder"] });
    await queryClient.invalidateQueries({ queryKey: ["contact-groups"] });
    await queryClient.invalidateQueries({ queryKey: ["contact", params.id] });
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    toast("Copied");
  }

  async function removeGroup(name: string) {
    if (!contact) return;
    const next = membership(contact).filter((item) => item !== name);
    await api(`/contacts/${contact.id}`, { method: "PATCH", body: JSON.stringify({ name: contact.name, groups: next }) });
    await refresh();
  }

  async function addGroup() {
    if (!contact || !addingGroup) return;
    await api("/contacts/categorize", { method: "POST", body: JSON.stringify({ ids: [contact.id], groupName: addingGroup }) });
    setAddingGroup("");
    await refresh();
    toast("Group added");
  }

  async function saveMemo() {
    if (!contact || memo === null) return;
    await api(`/contacts/${contact.id}`, { method: "PATCH", body: JSON.stringify({ name: contact.name, notes: memo }) });
    setMemo(null);
    await refresh();
    toast("Memo saved");
  }

  async function removeCard() {
    if (!contact || !window.confirm(`Delete ${contact.name}?`)) return;
    await api(`/contacts/${contact.id}`, { method: "DELETE" });
    toast("Card deleted");
    router.push(holderHref(state));
  }

  const assigned = contact ? membership(contact) : [];
  const available = (groups.data?.groups ?? []).map((item) => item.name).filter((name) => !assigned.includes(name));

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#eef1f4] md:flex-row">
      <aside className="flex max-h-[42vh] w-full shrink-0 flex-col border-b border-[#e6e8ee] bg-white md:max-h-none md:w-[320px] md:border-b-0 md:border-r">
        <div className="flex items-center justify-between border-b border-[#eef0f3] px-3 py-2 text-sm">
          <span className="truncate font-medium">{title} Found {total} items</span>
        </div>
        <div className="border-b border-[#eef0f3] p-2">
          <input className="h-8 w-full rounded border border-[#e1e4ea] px-2 text-[13px] outline-none focus:border-[#1aa3e8]" placeholder="Search" value={q} onChange={(event) => setQ(event.target.value)} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows.map((row) => {
            const active = row.id === params.id;
            return (
              <button key={row.id} className={`flex w-full gap-2 border-b border-[#f2f4f7] px-3 py-2 text-left ${active ? "bg-[#1aa3e8] text-white" : "hover:bg-[#f7f8fa]"}`} onClick={() => go({}, row.id)}>
                <Thumb contact={row} light={active} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{row.name}</span>
                  <span className={`block truncate text-xs ${active ? "text-white/90" : "text-[#66707c]"}`}>{row.jobTitle}</span>
                  <span className={`block truncate text-xs ${active ? "text-white/90" : "text-[#66707c]"}`}>{row.company}</span>
                </span>
              </button>
            );
          })}
          {!rows.length && !cards.isLoading ? <div className="grid h-24 place-items-center text-sm text-[#b0b6be]">No cards</div> : null}
        </div>
        <div className="flex items-center justify-center gap-3 border-t border-[#eef0f3] py-2 text-[13px] text-[#66707c]">
          <button disabled={state.page <= 1} className="disabled:opacity-40" onClick={() => go({ page: state.page - 1 })}>Previous</button>
          <span>{state.page} / {pages} Page</span>
          <button disabled={state.page >= pages} className="disabled:opacity-40" onClick={() => go({ page: state.page + 1 })}>Next</button>
        </div>
      </aside>
      <section className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3 md:p-4">
        {!contact ? <div className="grid h-48 place-items-center rounded bg-white text-sm text-[#8b919a]">{fetched.isError ? "Card not found" : "Loading card…"}</div> : (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded bg-white p-4">
              <Thumb contact={contact} large />
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-lg font-semibold">{contact.name}</h1>
                <p className="truncate text-sm text-[#66707c]">{contact.jobTitle}</p>
                <p className="truncate text-sm text-[#66707c]">{contact.company}</p>
              </div>
              <div className="relative flex shrink-0">
                <Link href={`/cardholder/${contact.id}/edit${searchParams.toString() ? `?${searchParams.toString()}` : ""}`} className="inline-flex h-8 items-center rounded-l border border-[#d9dee6] bg-white px-3 text-sm">Edit</Link>
                <button className="inline-flex h-8 items-center rounded-r border border-l-0 border-[#d9dee6] bg-white px-2" aria-label="More actions" onClick={() => setMenu((value) => !value)}><ChevronDown size={14} /></button>
                {menu ? (
                  <button className="absolute right-0 top-9 z-10 rounded border border-[#e6e8ee] bg-white px-3 py-2 text-left text-sm shadow" onClick={() => void removeCard()}>Delete</button>
                ) : null}
              </div>
            </div>
            <Panel title="Groups and Notes">
              <div className="flex flex-wrap items-center gap-2">
                {assigned.map((name) => (
                  <span key={name} className="inline-flex items-center gap-1 rounded bg-[#e8f6fd] px-2 py-1 text-sm text-[#1287c4]">
                    {name}
                    <button aria-label={`Remove ${name}`} onClick={() => void removeGroup(name)}>×</button>
                  </span>
                ))}
                <select className="h-8 rounded border border-[#e1e4ea] px-2 text-sm" value={addingGroup} aria-label="Add group" onChange={(event) => setAddingGroup(event.target.value)}>
                  <option value="">Add group</option>
                  {available.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
                <button className="h-8 rounded border border-[#e1e4ea] px-2 text-sm" disabled={!addingGroup} onClick={() => void addGroup()}>Add</button>
              </div>
              {memo !== null ? (
                <div className="mt-3">
                  <textarea className="h-24 w-full rounded border border-[#e1e4ea] p-2 text-sm" value={memo} onChange={(event) => setMemo(event.target.value)} />
                  <button className="mt-2 h-8 rounded bg-[#1aa3e8] px-3 text-sm text-white" onClick={() => void saveMemo()}>Save memo</button>
                </div>
              ) : contact.notes ? (
                <p className="mt-3 whitespace-pre-wrap text-sm text-[#3d4550]">{contact.notes} <button className="text-[#1aa3e8]" onClick={() => setMemo(contact.notes || "")}>Edit</button></p>
              ) : (
                <button className="mt-3 text-sm text-[#1aa3e8]" onClick={() => setMemo("")}>Create new memo</button>
              )}
            </Panel>
            <Panel title="Contact Info">
              <Info label="Mobile" value={contact.mobile} onCopy={copy} />
              <Info label="Telephone" value={contact.phone} onCopy={copy} />
              {showAll ? <Info label="Fax" value={contact.details?.faxes?.find(Boolean)} onCopy={copy} /> : null}
              <Info label="Email" value={contact.email} href={contact.email ? `mailto:${contact.email}` : undefined} onCopy={copy} />
              {showAll ? <Info label="Website" value={contact.website || contact.details?.websites?.find(Boolean)} href={contact.website || contact.details?.websites?.find(Boolean) || undefined} onCopy={copy} /> : null}
              {showAll ? <Info label="Address" value={contact.address} onCopy={copy} /> : null}
              <button className="mt-2 text-sm text-[#1aa3e8]" onClick={() => setShowAll((value) => !value)}>{showAll ? "Show less" : "Show more"}</button>
            </Panel>
            <Panel title="Company Info">
              <p className="text-sm font-medium">{contact.company}</p>
              <p className="mt-1 text-sm text-[#66707c]">{[contact.department, contact.jobTitle].filter(Boolean).join(" ")}</p>
            </Panel>
            <Panel title="Other Info">
              <Other contact={contact} />
            </Panel>
          </div>
        )}
      </section>
    </div>
  );
}

function membership(contact: Contact) {
  return contact.groups?.length ? contact.groups : contact.groupName ? [contact.groupName] : [];
}

function Thumb({ contact, light, large }: { contact: Contact; light?: boolean; large?: boolean }) {
  const url = contact.cardImageUrl || contact.imageUrl;
  const box = large ? "h-16 w-24" : "h-12 w-16";
  if (!url || contact.details?.frontKind === "pdf") return <span className={`grid shrink-0 place-items-center text-[11px] ${box} ${light ? "bg-white/20" : "bg-[#eef1f4]"}`}>{url ? "PDF" : ""}</span>;
  return <img src={url} alt="" className={`${box} shrink-0 object-cover`} />;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded bg-white p-4">
      <h2 className="mb-3 text-sm font-medium text-[#3d4550]">{title}</h2>
      {children}
    </section>
  );
}

function Info({ label, value, href, onCopy }: { label: string; value?: string | null; href?: string; onCopy: (value: string) => void }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-1.5 text-sm">
      <span className="w-24 shrink-0 text-[#8b919a]">{label}</span>
      {href ? <a className="min-w-0 break-all text-[#1aa3e8]" href={href.startsWith("mailto:") || href.startsWith("http") ? href : `https://${href}`} target={href.startsWith("mailto:") ? undefined : "_blank"} rel="noreferrer">{value}</a> : <span className="min-w-0 break-all">{value}</span>}
      <button className="ml-auto shrink-0 text-[#98a2ad]" aria-label={`Copy ${label}`} onClick={() => onCopy(value)}><Copy size={14} /></button>
    </div>
  );
}

function Other({ contact }: { contact: Contact }) {
  const details = contact.details || {};
  const rows = [
    ["Nickname", details.nickname],
    ["Chinese name", contact.nameZh],
    ["English name", contact.nameEn],
    ["Date received", details.dateReceived],
    ...(details.ims ?? []).filter((item) => item.value).map((item) => [item.network, item.value] as [string, string]),
    ...(details.keyDates ?? []).filter((item) => item.value).map((item) => [item.kind, item.value] as [string, string]),
  ].filter((row): row is [string, string] => Boolean(row[1]));
  if (!rows.length) return <p className="text-sm text-[#8b919a]">No other details</p>;
  return (
    <div>
      {rows.map(([label, value]) => (
        <div key={`${label}-${value}`} className="flex gap-3 py-1 text-sm">
          <span className="w-28 shrink-0 text-[#8b919a]">{label}</span>
          <span className="min-w-0 break-all">{value}</span>
        </div>
      ))}
    </div>
  );
}
