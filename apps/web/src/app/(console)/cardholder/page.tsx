"use client";

import { Button, controlClass, Dialog } from "@/components/ui";
import { api, download } from "@/lib/api";
import { useSession } from "@/lib/store";
import type { Contact } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import JSZip from "jszip";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const pageSize = 59;

type Groups = { all: number; ungrouped: number; groups: { name: string; count: number }[] };
type Page = { items: Contact[]; total: number; page: number; pageSize: number };

export default function CardholderPage() {
  const router = useRouter();
  const toast = useSession((state) => state.toast);
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<"mine" | "company">("mine");
  const [group, setGroup] = useState("");
  const [sort, setSort] = useState("created");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [newGroup, setNewGroup] = useState("");
  const [naming, setNaming] = useState(false);
  const [managing, setManaging] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [note, setNote] = useState<Contact | null>(null);
  const [noteText, setNoteText] = useState("");
  const [preview, setPreview] = useState<Contact | null>(null);
  const [previewSide, setPreviewSide] = useState<"front" | "back">("front");

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(q), 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort, scope });
  if (group) params.set("group", group);
  if (search) params.set("q", search);
  const cards = useQuery({
    queryKey: ["cardholder", scope, group, sort, search, page],
    queryFn: () => api<Page>(`/contacts?${params.toString()}`),
  });
  const groups = useQuery({ queryKey: ["contact-groups", scope], queryFn: () => api<Groups>(`/contacts/groups?scope=${scope}`) });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["cardholder"] });
    await queryClient.invalidateQueries({ queryKey: ["contact-groups"] });
    await queryClient.invalidateQueries({ queryKey: ["contacts"] });
  };
  const rows = cards.data?.items ?? [];
  const total = cards.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const title = group === "-" ? "Ungrouped" : group || "All Cards";
  const allChecked = rows.length > 0 && rows.every((row) => selected.includes(row.id));

  function chooseGroup(next: string) {
    setGroup(next);
    setPage(1);
    setSelected([]);
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
    const query = new URLSearchParams({ format: "xlsx", scope });
    if (group) query.set("group", group);
    if (search) query.set("q", search);
    return download(`/contacts/export?${query.toString()}`, "cards.xlsx");
  }

  return (
    <div className="-mx-4 -mt-5 md:-mx-8 md:-mt-6">
      <div className="flex items-center gap-2 border-b border-[#e6e8ee] bg-white px-4 py-2 text-sm text-[#1aa3e8]">
        <button onClick={() => { setScope(scope === "mine" ? "company" : "mine"); setPage(1); setSelected([]); }}>
          {scope === "mine" ? "Switch to Company Cardholder" : "Switch to My Cardholder"}
        </button>
      </div>
      <div className="flex min-h-[calc(100vh-8rem)]">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-[#e6e8ee] bg-white md:flex md:max-h-[calc(100vh-8rem)]">
          <div className="p-3 pb-1">
            <select className={`${controlClass} mb-4`} value={sort} aria-label="Sort" onChange={(event) => { setSort(event.target.value); setPage(1); }}>
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
            <button className="mb-3 block text-sm text-[#1aa3e8]" onClick={() => setManaging(true)}>Manage Groups</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            <GroupOption label="All Cards" count={groups.data?.all ?? 0} active={group === ""} onClick={() => chooseGroup("")} />
            <GroupOption label="Ungrouped" count={groups.data?.ungrouped ?? 0} active={group === "-"} onClick={() => chooseGroup("-")} />
            {(groups.data?.groups ?? []).map((item) => (
              <GroupOption key={item.name} label={item.name} count={item.count} active={group === item.name} onClick={() => chooseGroup(item.name)} />
            ))}
          </div>
        </aside>
        <section className="min-w-0 flex-1 bg-white">
          <div className="border-b border-[#eef0f3] px-4 py-3">
            <div className="text-lg font-medium">{title}</div>
            <select className={`${controlClass} mt-2 md:hidden`} value={sort} aria-label="Sort" onChange={(event) => { setSort(event.target.value); setPage(1); }}>
              <option value="created">Sort by Date</option>
              <option value="name">Sort by Name</option>
              <option value="company">Sort by Company</option>
            </select>
            <select className={`${controlClass} mt-2 md:hidden`} value={group} aria-label="Group" onChange={(event) => chooseGroup(event.target.value)}>
              <option value="">All Cards ({groups.data?.all ?? 0})</option>
              <option value="-">Ungrouped ({groups.data?.ungrouped ?? 0})</option>
              {(groups.data?.groups ?? []).map((item) => <option key={item.name} value={item.name}>{item.name} ({item.count})</option>)}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-[#eef0f3] px-3 py-2">
            <Button variant="ghost" onClick={() => (selected.length ? setCategorizing(true) : toast("Select at least one card", "err"))}>Categorize</Button>
            <Button variant="ghost" onClick={() => removeSelected()}>Delete</Button>
            <input className={`${controlClass} ml-auto w-56 max-w-full`} placeholder="Search by name, company, job title, city and more" value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} onKeyDown={(event) => { if (event.key === "Enter") setSearch(q); }} />
            <Button variant="ghost" onClick={() => setSearch(q)}>Search</Button>
            <Button variant="ghost" onClick={() => void exportImages()}>Export business card image</Button>
            <Button variant="ghost" onClick={() => void exportExcel()}>Export Excel</Button>
            <Button variant="ghost" onClick={() => void merge()}>Merge duplicate cards</Button>
            <button className="inline-flex h-9 items-center rounded bg-[#f39c12] px-3 text-sm font-medium text-white" onClick={() => router.push("/cardholder/new")}>+ Add Card</button>
          </div>
          <div className="overflow-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-[#fafbfc] text-[#66707c]">
                <tr>
                  <th className="w-10 px-3 py-2"><input type="checkbox" aria-label="Select all" checked={allChecked} onChange={(event) => setSelected(event.target.checked ? Array.from(new Set([...selected, ...rows.map((row) => row.id)])) : selected.filter((id) => !rows.some((row) => row.id === id)))} /></th>
                  {["Card Image", "Name", "Company", "Title", "Email", "Telephone", "Create Time", "Note"].map((heading) => <th key={heading} className="px-3 py-2 font-medium">{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#f2f4f7] [content-visibility:auto] [contain-intrinsic-size:auto_52px]">
                    <td className="px-3 py-2"><input type="checkbox" aria-label={`Select ${row.name}`} checked={selected.includes(row.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, row.id] : selected.filter((id) => id !== row.id))} /></td>
                    <td className="px-3 py-2">{row.cardImageUrl || row.imageUrl ? <button type="button" aria-label={`Preview ${row.name}`} onClick={() => { setPreview(row); setPreviewSide("front"); }}>{row.details?.frontKind === "pdf" ? <span className="grid h-10 w-16 place-items-center rounded bg-[#eef1f4] text-xs">PDF</span> : <img src={row.cardImageUrl || row.imageUrl || ""} alt="" loading="lazy" decoding="async" className="h-10 w-16 rounded object-cover" />}</button> : <div className="h-10 w-16 rounded bg-[#eef1f4]" />}</td>
                    <td className="px-3 py-2 font-medium"><Link href={`/cardholder/${row.id}`} className="hover:text-[#1aa3e8]">{row.name}</Link></td>
                    <td className="px-3 py-2">{row.company}</td>
                    <td className="px-3 py-2">{row.jobTitle}</td>
                    <td className="px-3 py-2">{row.email}</td>
                    <td className="px-3 py-2">{row.mobile || row.phone}</td>
                    <td className="px-3 py-2">{row.createdAt.slice(0, 10)}</td>
                    <td className="px-3 py-2"><button className="text-[#8b919a]" onClick={() => { setNote(row); setNoteText(row.notes || ""); }}>Note</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && !cards.isLoading ? <div className="grid h-40 place-items-center text-sm text-[#b0b6be]">No cards</div> : null}
          </div>
          <div className="flex items-center justify-between border-t border-[#eef0f3] px-4 py-3 text-sm text-[#66707c]">
            <span>{pageSize} cards per page</span>
            <span className="flex items-center gap-3">
              <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="disabled:opacity-40">Previous</button>
              <span>{page} / {pages} Page</span>
              <button disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="disabled:opacity-40">Next</button>
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
      {preview ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#1c1f23]/50 p-4" onClick={() => setPreview(null)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-4" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex gap-2">
                <button type="button" className={`rounded px-3 py-1 text-sm ${previewSide === "front" ? "bg-[#e8f6fd] text-[#1aa3e8]" : "text-[#66707c]"}`} onClick={() => setPreviewSide("front")}>Front</button>
                {preview.cardBackUrl ? <button type="button" className={`rounded px-3 py-1 text-sm ${previewSide === "back" ? "bg-[#e8f6fd] text-[#1aa3e8]" : "text-[#66707c]"}`} onClick={() => setPreviewSide("back")}>Back</button> : null}
              </div>
              <button type="button" className="text-sm text-[#66707c]" onClick={() => setPreview(null)}>Close</button>
            </div>
            <CardPreview contact={preview} side={previewSide} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CardPreview({ contact, side }: { contact: Contact; side: "front" | "back" }) {
  const url = side === "back" ? contact.cardBackUrl : contact.cardImageUrl || contact.imageUrl;
  const pdf = side === "front" && contact.details?.frontKind === "pdf";
  if (!url) return <div className="grid h-48 place-items-center text-sm text-[#8b919a]">No image</div>;
  if (pdf || (side === "back" && contact.details?.backKind === "pdf")) return <iframe title={`${contact.name} card`} src={url} className="h-[70vh] w-full rounded border" />;
  return <img src={url} alt={`${contact.name} card`} className="mx-auto max-h-[70vh] max-w-full object-contain" />;
}

function GroupOption({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button className={`flex w-full items-center gap-2 rounded px-1 py-1 text-left text-sm ${active ? "bg-[#e8f6fd] font-medium text-[#1aa3e8]" : "text-[#3d4550]"}`} aria-current={active ? "true" : undefined} onClick={onClick}>
      <span className={`h-3.5 w-3.5 rounded-full border ${active ? "border-[#1aa3e8] bg-[#1aa3e8]" : "border-[#c5ccd4]"}`} />
      <span className="min-w-0 flex-1 truncate">{label} ({count})</span>
    </button>
  );
}

function ManageGroups({ groups, onChanged }: { groups: { name: string; count: number }[]; onChanged: () => Promise<void> }) {
  const toast = useSession((state) => state.toast);
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
