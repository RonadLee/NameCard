"use client";

import { MobileHolder } from "@/components/mobile-holder";
import { Button, controlClass, Dialog } from "@/components/ui";
import { api, download } from "@/lib/api";
import { holderHref, holderPageSize, readHolder, type HolderState } from "@/lib/holder";
import { useSession } from "@/lib/store";
import { useWide } from "@/lib/wide";
import type { Contact } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import JSZip from "jszip";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Groups = { all: number; ungrouped: number; groups: { name: string; count: number }[] };
type Page = { items: Contact[]; total: number; page: number; pageSize: number };

export default function CardholderPage() {
  const wide = useWide();
  if (wide === false) return <MobileHolder />;
  return <DesktopCardholder />;
}

function DesktopCardholder() {
  const wide = useWide();
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = readHolder(searchParams);
  const toast = useSession((s) => s.toast);
  const queryClient = useQueryClient();
  const [q, setQ] = useState(state.q);
  const [selected, setSelected] = useState<string[]>([]);
  const [newGroup, setNewGroup] = useState("");
  const [naming, setNaming] = useState(false);
  const [managing, setManaging] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [note, setNote] = useState<Contact | null>(null);
  const [noteText, setNoteText] = useState("");

  useEffect(() => setQ(state.q), [state.q]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (q !== state.q) go({ q, page: 1 });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  const params = new URLSearchParams({ page: String(state.page), pageSize: String(holderPageSize), sort: state.sort, scope: state.scope });
  if (state.group) params.set("group", state.group);
  if (state.q) params.set("q", state.q);
  const cards = useQuery({
    queryKey: ["cardholder", state.scope, state.group, state.sort, state.q, state.page],
    queryFn: () => api<Page>(`/contacts?${params.toString()}`),
    staleTime: 15_000,
    enabled: wide === true,
  });
  const groups = useQuery({ queryKey: ["contact-groups", state.scope], queryFn: () => api<Groups>(`/contacts/groups?scope=${state.scope}`), staleTime: 15_000, enabled: wide === true });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["cardholder"] });
    await queryClient.invalidateQueries({ queryKey: ["contact-groups"] });
    await queryClient.invalidateQueries({ queryKey: ["contacts"] });
  };
  const rows = cards.data?.items ?? [];
  const total = cards.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / holderPageSize));
  const title = state.group === "-" ? "Ungrouped" : state.group || "All Cards";
  const allChecked = rows.length > 0 && rows.every((row) => selected.includes(row.id));

  function go(partial: Partial<HolderState>) {
    const next = { ...state, ...partial };
    setSelected([]);
    router.replace(holderHref(next));
  }

  const createGroup = useMutation({
    mutationFn: () => api("/contacts/groups", { method: "POST", body: JSON.stringify({ name: newGroup }) }),
    onSuccess: async () => { setNewGroup(""); setNaming(false); await refresh(); toast("Group created"); },
    onError: (error) => toast(error instanceof Error ? error.message : "Could not create the group", "err"),
  });

  async function removeSelected() {
    if (!selected.length) return toast("Select at least one card", "err");
    if (!window.confirm(`Delete ${selected.length} card${selected.length === 1 ? "" : "s"}?`)) return;
    try {
      await api("/contacts/remove", { method: "POST", body: JSON.stringify({ ids: selected }) });
      setSelected([]);
      await refresh();
      toast("Cards deleted");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete", "err");
    }
  }

  async function categorize(name: string) {
    try {
      await api("/contacts/categorize", { method: "POST", body: JSON.stringify({ ids: selected, groupName: name }) });
      setCategorizing(false);
      setSelected([]);
      await refresh();
      toast("Cards categorized");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not categorize", "err");
    }
  }

  async function merge() {
    if (selected.length < 2) return toast("Select at least two cards to merge", "err");
    try {
      await api("/contacts/merge", { method: "POST", body: JSON.stringify({ keepId: selected[0], dropIds: selected.slice(1) }) });
      setSelected([]);
      await refresh();
      toast("Duplicate cards merged");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not merge", "err");
    }
  }

  async function exportImages() {
    const zip = new JSZip();
    let count = 0;
    for (const row of rows.filter((item) => selected.length === 0 || selected.includes(item.id))) {
      const files = [row.cardImageUrl, row.cardBackUrl].filter((url): url is string => Boolean(url));
      for (const [index, url] of files.entries()) {
        const res = await fetch(url);
        if (!res.ok) continue;
        zip.file(`${row.name || "card"}-${row.id}${index === 0 ? "" : "-back"}.png`, await res.arrayBuffer());
        count += 1;
      }
    }
    if (!count) return toast("No card images to export", "err");
    const blob = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "card-images.zip";
    link.click();
  }

  function exportExcel() {
    const query = new URLSearchParams({ format: "xlsx", scope: state.scope });
    if (state.group) query.set("group", state.group);
    if (state.q) query.set("q", state.q);
    return download(`/contacts/export?${query.toString()}`, "cards.xlsx");
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="border-b border-[#e6e8ee] px-4 py-2 text-sm text-[#1aa3e8]">
        <button onClick={() => go({ scope: state.scope === "mine" ? "company" : "mine", page: 1 })}>
          {state.scope === "mine" ? "Switch to Company Cardholder" : "Switch to My Cardholder"}
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[220px] shrink-0 flex-col border-r border-[#e6e8ee] md:flex">
          <div className="p-3 pb-1">
            <select className="mb-3 h-8 w-full rounded border border-[#e1e4ea] bg-white px-2 text-sm" value={state.sort} aria-label="Sort" onChange={(event) => go({ sort: event.target.value, page: 1 })}>
              <option value="created">Sort by Date</option>
              <option value="name">Sort by Name</option>
              <option value="company">Sort by Company</option>
            </select>
            <div className="mb-2 text-sm font-medium">Group</div>
            {naming ? (
              <div className="mb-2 flex gap-1">
                <input className={controlClass} value={newGroup} onChange={(event) => setNewGroup(event.target.value)} placeholder="Group name" />
                <Button onClick={() => createGroup.mutate()} disabled={!newGroup.trim()}>Add</Button>
              </div>
            ) : (
              <button className="mb-1 block text-sm text-[#1aa3e8]" onClick={() => setNaming(true)}>+ New a Group</button>
            )}
            <button className="mb-2 block text-sm text-[#1aa3e8]" onClick={() => setManaging(true)}>Manage Groups</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            <GroupOption label="All Cards" count={groups.data?.all ?? 0} active={state.group === ""} onClick={() => go({ group: "", page: 1 })} />
            <GroupOption label="Ungrouped" count={groups.data?.ungrouped ?? 0} active={state.group === "-"} onClick={() => go({ group: "-", page: 1 })} />
            {(groups.data?.groups ?? []).map((item) => (
              <GroupOption key={item.name} label={item.name} count={item.count} active={state.group === item.name} onClick={() => go({ group: item.name, page: 1 })} />
            ))}
          </div>
        </aside>
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-[#eef0f3] px-4 py-2">
            <div className="text-base font-medium">{title}</div>
            <div className="mt-2 grid gap-2 md:hidden">
              <select className="h-9 rounded border border-[#e1e4ea] px-2 text-sm" value={state.sort} aria-label="Sort" onChange={(event) => go({ sort: event.target.value, page: 1 })}>
                <option value="created">Sort by Date</option>
                <option value="name">Sort by Name</option>
                <option value="company">Sort by Company</option>
              </select>
              <select className="h-9 rounded border border-[#e1e4ea] px-2 text-sm" value={state.group} aria-label="Group" onChange={(event) => go({ group: event.target.value, page: 1 })}>
                <option value="">All Cards ({groups.data?.all ?? 0})</option>
                <option value="-">Ungrouped ({groups.data?.ungrouped ?? 0})</option>
                {(groups.data?.groups ?? []).map((item) => <option key={item.name} value={item.name}>{item.name} ({item.count})</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-[#eef0f3] px-3 py-2">
            <ToolbarButton onClick={() => (selected.length ? setCategorizing(true) : toast("Select at least one card", "err"))}>Categorize</ToolbarButton>
            <ToolbarButton onClick={() => void removeSelected()}>Delete</ToolbarButton>
            <input className="ml-auto h-8 w-56 max-w-full rounded border border-[#e1e4ea] px-2 text-[13px] outline-none focus:border-[#1aa3e8]" placeholder="Search by name, company, job title, city and more" value={q} onChange={(event) => setQ(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") go({ q, page: 1 }); }} />
            <ToolbarButton onClick={() => go({ q, page: 1 })}>Search</ToolbarButton>
            <ToolbarButton onClick={() => void exportImages()}>Export business card image</ToolbarButton>
            <ToolbarButton onClick={() => void exportExcel()}>Export Excel</ToolbarButton>
            <ToolbarButton onClick={() => void merge()}>Merge duplicate cards</ToolbarButton>
            <button className="inline-flex h-8 items-center rounded bg-[#f39c12] px-3 text-[13px] font-medium text-white" onClick={() => router.push(holderHref(state).replace("/cardholder", "/cardholder/new"))}>+ Add Card</button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[960px] border-collapse text-left text-[13px]">
              <thead className="sticky top-0 bg-[#fafbfc] text-[#66707c]">
                <tr>
                  <th className="w-10 px-3 py-2 font-medium"><input type="checkbox" aria-label="Select all" checked={allChecked} onChange={(event) => setSelected(event.target.checked ? rows.map((row) => row.id) : [])} /></th>
                  {["Card Image", "Name", "Company", "Title", "Email", "Telephone", "Create Time", "Note"].map((heading) => <th key={heading} className="px-3 py-2 font-medium">{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="cursor-pointer border-t border-[#f2f4f7] hover:bg-[#f8fafc] [content-visibility:auto] [contain-intrinsic-size:auto_44px]" onClick={() => router.push(holderHref(state, row.id))}>
                    <td className="px-3 py-1.5" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`Select ${row.name}`} checked={selected.includes(row.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, row.id] : selected.filter((id) => id !== row.id))} /></td>
                    <td className="px-3 py-1.5">{row.cardImageUrl || row.imageUrl ? row.details?.frontKind === "pdf" ? <span className="grid h-9 w-14 place-items-center bg-[#eef1f4] text-[11px]">PDF</span> : <img src={row.cardImageUrl || row.imageUrl || ""} alt="" loading="lazy" decoding="async" className="h-9 w-14 object-cover" /> : <div className="h-9 w-14 bg-[#eef1f4]" />}</td>
                    <td className="px-3 py-1.5 font-medium">{row.name}</td>
                    <td className="max-w-[180px] truncate px-3 py-1.5">{row.company}</td>
                    <td className="max-w-[160px] truncate px-3 py-1.5">{row.jobTitle}</td>
                    <td className="max-w-[180px] truncate px-3 py-1.5">{row.email}</td>
                    <td className="px-3 py-1.5">{row.mobile || row.phone}</td>
                    <td className="px-3 py-1.5">{row.createdAt.slice(0, 10)}</td>
                    <td className="px-3 py-1.5" onClick={(event) => event.stopPropagation()}><button className="text-[#8b919a]" onClick={() => { setNote(row); setNoteText(row.notes || ""); }}>Note</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && !cards.isLoading ? <div className="grid h-40 place-items-center text-sm text-[#b0b6be]">No cards</div> : null}
          </div>
          <div className="flex items-center justify-between border-t border-[#eef0f3] px-4 py-2 text-[13px] text-[#66707c]">
            <span>{holderPageSize} cards per page</span>
            <span className="flex items-center gap-3">
              <button disabled={state.page <= 1} onClick={() => go({ page: state.page - 1 })} className="disabled:opacity-40">Previous</button>
              <span>{state.page} / {pages} Page</span>
              <button disabled={state.page >= pages} onClick={() => go({ page: state.page + 1 })} className="disabled:opacity-40">Next</button>
            </span>
          </div>
        </section>
      </div>
      <Dialog open={categorizing} title="Categorize" onClose={() => setCategorizing(false)}>
        <p className="mb-3 text-sm text-[#66707c]">Adds the selected cards to a group. A card can stay in its other groups.</p>
        <div className="space-y-2">
          {(groups.data?.groups ?? []).map((item) => (
            <button key={item.name} className="block w-full rounded-xl bg-[#f6f7f9] px-3 py-2 text-left text-sm" onClick={() => categorize(item.name)}>{item.name}</button>
          ))}
          {!groups.data?.groups.length ? <p className="text-sm text-[#8b919a]">Create a group first.</p> : null}
        </div>
      </Dialog>
      <Dialog open={managing} title="Manage Groups" onClose={() => setManaging(false)}>
        <ManageGroups groups={groups.data?.groups ?? []} onChanged={refresh} />
      </Dialog>
      <Dialog open={Boolean(note)} title={note ? `${note.name} note` : "Note"} onClose={() => setNote(null)}>
        <textarea className={`${controlClass} h-28 py-2`} value={noteText} onChange={(event) => setNoteText(event.target.value)} />
        <Button className="mt-3" onClick={async () => {
          if (!note) return;
          await api(`/contacts/${note.id}`, { method: "PATCH", body: JSON.stringify({ name: note.name, notes: noteText }) });
          setNote(null);
          await refresh();
          toast("Note saved");
        }}>Save note</Button>
      </Dialog>
    </div>
  );
}

function ToolbarButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button className="inline-flex h-8 items-center rounded border border-[#e1e4ea] bg-white px-2.5 text-[13px] text-[#3d4550] hover:bg-[#f7f8fa]" onClick={onClick}>{children}</button>;
}

function GroupOption({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[13px] ${active ? "bg-[#e8f6fd] font-medium text-[#1aa3e8]" : "text-[#3d4550]"}`} aria-current={active ? "true" : undefined} onClick={onClick}>
      <span className={`h-3.5 w-3.5 rounded-full border ${active ? "border-[#1aa3e8] bg-[#1aa3e8] shadow-[inset_0_0_0_2px_white]" : "border-[#c5ccd4]"}`} />
      <span className="min-w-0 flex-1 truncate">{label} ({count})</span>
    </button>
  );
}

function ManageGroups({ groups, onChanged }: { groups: { name: string; count: number }[]; onChanged: () => Promise<void> }) {
  const toast = useSession((s) => s.toast);
  const [names, setNames] = useState<Record<string, string>>({});
  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <div key={group.name} className="flex gap-2">
          <input className={controlClass} value={names[group.name] ?? group.name} onChange={(event) => setNames({ ...names, [group.name]: event.target.value })} />
          <Button variant="ghost" onClick={async () => {
            const to = (names[group.name] ?? group.name).trim();
            if (!to || to === group.name) return;
            await api("/contacts/groups", { method: "PATCH", body: JSON.stringify({ from: group.name, to }) });
            await onChanged();
            toast("Group renamed");
          }}>Rename</Button>
          <Button variant="ghost" onClick={async () => {
            if (group.count > 0 && !window.confirm(`"${group.name}" has ${group.count} card${group.count === 1 ? "" : "s"}. Remove the group? Cards that also belong to other groups stay in those groups.`)) return;
            await api(`/contacts/groups?name=${encodeURIComponent(group.name)}`, { method: "DELETE" });
            await onChanged();
            toast("Group removed");
          }}>Delete</Button>
        </div>
      ))}
      {!groups.length ? <p className="text-sm text-[#8b919a]">No groups yet.</p> : null}
    </div>
  );
}
