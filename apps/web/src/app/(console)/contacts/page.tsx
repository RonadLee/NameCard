"use client";

import { Button, controlClass, Dialog, Field, PageTitle } from "@/components/ui";
import { api, download } from "@/lib/api";
import { useSession } from "@/lib/store";
import type { Contact } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, Rows3, Star, Table2 } from "lucide-react";
import { useMemo, useState } from "react";

const sorts = [
  ["updated", "Recent"],
  ["name", "Name"],
  ["company", "Company"],
];

const blank = { name: "", nameZh: "", nameEn: "", company: "", jobTitle: "", department: "", email: "", mobile: "", phone: "", whatsapp: "", website: "", address: "", groupName: "", tags: "", notes: "", favorite: false };

type Draft = typeof blank & { id?: string };

export default function ContactsPage() {
  const toast = useSession((state) => state.toast);
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("updated");
  const [group, setGroup] = useState("");
  const [tag, setTag] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [view, setView] = useState<"table" | "grid" | "card">("table");
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const contacts = useQuery({
    queryKey: ["contacts", q, sort, group, tag, favoritesOnly],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (sort !== "updated") params.set("sort", sort);
      if (group) params.set("group", group);
      if (tag) params.set("tag", tag);
      if (favoritesOnly) params.set("favorite", "1");
      const query = params.toString();
      return api<Contact[]>(`/contacts${query ? `?${query}` : ""}`);
    },
  });
  const catalog = useQuery({ queryKey: ["contacts", "catalog"], queryFn: () => api<Contact[]>("/contacts") });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["contacts"] });
  const groups = useMemo(() => Array.from(new Set((catalog.data ?? []).map((contact) => contact.groupName).filter(Boolean))) as string[], [catalog.data]);
  const tags = useMemo(() => Array.from(new Set((catalog.data ?? []).flatMap((contact) => contact.tags))), [catalog.data]);
  const rows = contacts.data ?? [];
  const save = useMutation({
    mutationFn: (input: Draft) => {
      const payload = {
        name: input.name.trim(),
        nameZh: input.nameZh,
        nameEn: input.nameEn,
        company: input.company,
        jobTitle: input.jobTitle,
        department: input.department,
        email: input.email,
        mobile: input.mobile,
        phone: input.phone,
        whatsapp: input.whatsapp,
        website: input.website,
        address: input.address,
        groupName: input.groupName,
        notes: input.notes,
        favorite: input.favorite,
        tags: input.tags.split(",").map((item) => item.trim()).filter(Boolean),
      };
      return api(input.id ? `/contacts/${input.id}` : "/contacts", { method: input.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
    },
    onSuccess: async () => { setDraft(null); await refresh(); toast("Contact saved"); },
    onError: (error) => toast(error instanceof Error ? error.message : "Could not save", "err"),
  });
  const merge = useMutation({
    mutationFn: () => api("/contacts/merge", { method: "POST", body: JSON.stringify({ keepId: selected[0], dropIds: selected.slice(1) }) }),
    onSuccess: async () => { setSelected([]); setMergeOpen(false); await refresh(); toast("Contacts merged"); },
    onError: (error) => toast(error instanceof Error ? error.message : "Could not merge", "err"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/contacts/${id}`, { method: "DELETE" }),
    onSuccess: async () => { setRemoveId(null); setSelected((current) => current.filter((id) => id !== removeId)); await refresh(); toast("Contact deleted"); },
    onError: (error) => toast(error instanceof Error ? error.message : "Could not delete", "err"),
  });
  const favorite = useMutation({
    mutationFn: (contact: Contact) => api(`/contacts/${contact.id}`, { method: "PATCH", body: JSON.stringify({ name: contact.name, favorite: !contact.favorite }) }),
    onSuccess: async () => refresh(),
    onError: (error) => toast(error instanceof Error ? error.message : "Could not update", "err"),
  });

  function openContact(contact: Contact) {
    setDraft({
      id: contact.id,
      name: contact.name,
      nameZh: contact.nameZh || "",
      nameEn: contact.nameEn || "",
      company: contact.company || "",
      jobTitle: contact.jobTitle || "",
      department: contact.department || "",
      email: contact.email || "",
      mobile: contact.mobile || "",
      phone: contact.phone || "",
      whatsapp: contact.whatsapp || "",
      website: contact.website || "",
      address: contact.address || "",
      groupName: contact.groupName || "",
      tags: contact.tags.join(", "),
      notes: contact.notes || "",
      favorite: contact.favorite,
    });
  }

  async function importFile(file: File) {
    try {
      const body = new FormData();
      body.append("file", file);
      const result = await api<{ created: number }>("/contacts/import", { method: "POST", body });
      await refresh();
      toast(`Imported ${result.created} contacts`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Import failed", "err");
    }
  }

  const kept = rows.find((contact) => contact.id === selected[0]) ?? catalog.data?.find((contact) => contact.id === selected[0]);

  return (
    <div>
      <PageTitle title="Contacts" extra={<Button onClick={() => setDraft({ ...blank })}>Add contact</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className={`${controlClass} max-w-xs`} placeholder="Search name, company, email" value={q} onChange={(event) => setQ(event.target.value)} />
        <select className={`${controlClass} w-36`} value={sort} onChange={(event) => setSort(event.target.value)}>{sorts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select className={`${controlClass} w-40`} value={group} onChange={(event) => setGroup(event.target.value)}>
          <option value="">All groups</option>
          {groups.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className={`${controlClass} w-36`} value={tag} onChange={(event) => setTag(event.target.value)}>
          <option value="">All tags</option>
          {tags.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <button className={`rounded-full px-3 py-2 text-sm ${favoritesOnly ? "bg-[#1aa3e8] text-white" : "bg-white text-[#3d4550]"}`} onClick={() => setFavoritesOnly((value) => !value)}>Favorites</button>
        <div className="ml-auto flex gap-1 rounded-full bg-white p-1">
          <button aria-label="Table" onClick={() => setView("table")} className={view === "table" ? "rounded-full bg-[#eef8fd] p-2 text-[#1aa3e8]" : "p-2 text-[#8b919a]"}><Table2 size={16} /></button>
          <button aria-label="Grid" onClick={() => setView("grid")} className={view === "grid" ? "rounded-full bg-[#eef8fd] p-2 text-[#1aa3e8]" : "p-2 text-[#8b919a]"}><LayoutGrid size={16} /></button>
          <button aria-label="Cards" onClick={() => setView("card")} className={view === "card" ? "rounded-full bg-[#eef8fd] p-2 text-[#1aa3e8]" : "p-2 text-[#8b919a]"}><Rows3 size={16} /></button>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        <Button variant="ghost" onClick={() => download("/contacts/export?format=csv", "contacts.csv")}>CSV</Button>
        <Button variant="ghost" onClick={() => download("/contacts/export?format=xlsx", "contacts.xlsx")}>XLSX</Button>
        <Button variant="ghost" onClick={() => download("/contacts/export?format=vcf", "contacts.vcf")}>vCard</Button>
        <label className="inline-flex h-9 cursor-pointer items-center rounded-full border border-[#e4e7ec] bg-white px-4 text-sm">Import<input type="file" accept=".csv,.xlsx,.vcf" className="hidden" onChange={(event) => event.target.files?.[0] && importFile(event.target.files[0])} /></label>
        <Button variant="soft" disabled={selected.length < 2} onClick={() => setMergeOpen(true)}>Merge {selected.length || ""}</Button>
      </div>
      {contacts.isError ? <p className="mb-3 text-sm text-[#d14343]">Contacts could not be loaded. Refresh the page and try again.</p> : null}
      {contacts.isLoading ? <p className="mb-3 text-sm text-[#8b919a]">Loading contacts…</p> : null}
      {view === "table" ? (
        <div className="overflow-auto rounded-2xl bg-white shadow-card">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-[#98a1ab]"><tr>{["", "Name", "Company", "Title", "Email", "Mobile", "Group", ""].map((heading) => <th key={heading || "actions"} className="px-4 py-3 font-medium">{heading}</th>)}</tr></thead>
            <tbody>
              {rows.map((contact) => (
                <tr key={contact.id} className="border-t border-[#f4f6f9]">
                  <td className="px-4 py-3"><input type="checkbox" aria-label={`Select ${contact.name}`} checked={selected.includes(contact.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, contact.id] : selected.filter((id) => id !== contact.id))} /></td>
                  <td className="px-4 py-3 font-medium">
                    <button className="text-left" onClick={() => openContact(contact)}>{contact.name}</button>
                    {contact.favorite ? <span className="ml-2 text-[#f5b942]">★</span> : null}
                  </td>
                  <td className="px-4 py-3">{contact.company}</td>
                  <td className="px-4 py-3">{contact.jobTitle}</td>
                  <td className="px-4 py-3">{contact.email}</td>
                  <td className="px-4 py-3">{contact.mobile}</td>
                  <td className="px-4 py-3">{contact.groupName}</td>
                  <td className="px-4 py-3 text-right">
                    <button aria-label={`Favorite ${contact.name}`} className={contact.favorite ? "text-[#f5b942]" : "text-[#c5ccd4]"} onClick={() => favorite.mutate(contact)}><Star size={16} fill={contact.favorite ? "currentColor" : "none"} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && !contacts.isLoading ? <p className="px-4 py-10 text-center text-sm text-[#b0b6be]">No contacts match these filters.</p> : null}
        </div>
      ) : (
        <div className={view === "grid" ? "grid gap-3 md:grid-cols-3" : "space-y-3"}>
          {rows.map((contact) => (
            <button key={contact.id} className="rounded-2xl bg-white p-4 text-left shadow-card" onClick={() => openContact(contact)}>
              <div className="font-semibold">{contact.name}{contact.favorite ? " ★" : ""}</div>
              <div className="text-sm text-[#66707c]">{contact.jobTitle} · {contact.company}</div>
              <div className="mt-2 text-sm">{contact.email}</div>
              <div className="mt-1 text-xs text-[#8b919a]">{contact.groupName} {contact.tags.join(", ")}</div>
            </button>
          ))}
          {!rows.length && !contacts.isLoading ? <p className="text-sm text-[#b0b6be]">No contacts match these filters.</p> : null}
        </div>
      )}
      <Dialog open={Boolean(draft)} title={draft?.id ? "Edit contact" : "New contact"} onClose={() => setDraft(null)}>
        {draft ? (
          <div className="grid gap-3">
            {([
              ["name", "Name"],
              ["nameZh", "Chinese name"],
              ["nameEn", "English name"],
              ["company", "Company"],
              ["jobTitle", "Job title"],
              ["department", "Department"],
              ["email", "Email"],
              ["mobile", "Mobile"],
              ["phone", "Phone"],
              ["whatsapp", "WhatsApp"],
              ["website", "Website"],
              ["address", "Address"],
              ["groupName", "Group"],
              ["tags", "Tags"],
            ] as const).map(([key, label]) => (
              <Field key={key} label={label}><input className={controlClass} value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></Field>
            ))}
            <Field label="Notes"><textarea className={`${controlClass} h-20 py-2`} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.favorite} onChange={(event) => setDraft({ ...draft, favorite: event.target.checked })} /> Favorite</label>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => draft.name.trim() ? save.mutate(draft) : toast("Name is required", "err")} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save contact"}</Button>
              {draft.id ? <Button variant="ghost" onClick={() => { setRemoveId(draft.id!); setDraft(null); }}>Delete</Button> : null}
            </div>
          </div>
        ) : null}
      </Dialog>
      <Dialog open={mergeOpen} title="Merge contacts" onClose={() => setMergeOpen(false)}>
        <p className="text-sm text-[#66707c]">Keep {kept?.name || "the first selected contact"} and fold the other {Math.max(selected.length - 1, 0)} into it. Empty fields are filled from the records you drop.</p>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => merge.mutate()} disabled={merge.isPending}>Merge</Button>
          <Button variant="ghost" onClick={() => setMergeOpen(false)}>Cancel</Button>
        </div>
      </Dialog>
      <Dialog open={Boolean(removeId)} title="Delete contact" onClose={() => setRemoveId(null)}>
        <p className="text-sm text-[#66707c]">This removes the contact from the workspace cardholder.</p>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => removeId && remove.mutate(removeId)} disabled={remove.isPending}>Delete</Button>
          <Button variant="ghost" onClick={() => setRemoveId(null)}>Cancel</Button>
        </div>
      </Dialog>
    </div>
  );
}
