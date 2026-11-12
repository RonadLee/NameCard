"use client";

import { Button, controlClass, Dialog, Field, PageTitle } from "@/components/ui";
import { api, download } from "@/lib/api";
import { useSession } from "@/lib/store";
import type { Contact } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, Rows3, Table2 } from "lucide-react";
import { useMemo, useState } from "react";

const sorts = [
  ["updated", "Recent"],
  ["name", "Name"],
  ["company", "Company"],
];

export default function ContactsPage() {
  const toast = useSession((state) => state.toast);
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("updated");
  const [view, setView] = useState<"table" | "grid" | "card">("table");
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", company: "", email: "", mobile: "", jobTitle: "", groupName: "", tags: "" });
  const contacts = useQuery({
    queryKey: ["contacts", q, sort],
    queryFn: () => api<Contact[]>(`/contacts?q=${encodeURIComponent(q)}&sort=${sort === "updated" ? "" : sort}`),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["contacts"] });
  const save = useMutation({
    mutationFn: () => api("/contacts", { method: "POST", body: JSON.stringify({ ...draft, tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean) }) }),
    onSuccess: async () => { setOpen(false); await refresh(); toast("Contact saved"); },
    onError: (error) => toast(error instanceof Error ? error.message : "Could not save", "err"),
  });
  const merge = useMutation({
    mutationFn: () => api("/contacts/merge", { method: "POST", body: JSON.stringify({ keepId: selected[0], dropIds: selected.slice(1) }) }),
    onSuccess: async () => { setSelected([]); await refresh(); toast("Contacts merged"); },
    onError: (error) => toast(error instanceof Error ? error.message : "Could not merge", "err"),
  });
  const groups = useMemo(() => Array.from(new Set((contacts.data ?? []).map((contact) => contact.groupName).filter(Boolean))), [contacts.data]);

  async function importFile(file: File) {
    const body = new FormData();
    body.append("file", file);
    const result = await api<{ created: number }>("/contacts/import", { method: "POST", body });
    await refresh();
    toast(`Imported ${result.created} contacts`);
  }

  return (
    <div>
      <PageTitle title="Contacts" extra={<Button onClick={() => setOpen(true)}>Add contact</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className={`${controlClass} max-w-xs`} placeholder="Search name, company, email" value={q} onChange={(event) => setQ(event.target.value)} />
        <select className={`${controlClass} w-36`} value={sort} onChange={(event) => setSort(event.target.value)}>{sorts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
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
        <Button variant="soft" disabled={selected.length < 2} onClick={() => merge.mutate()}>Merge {selected.length || ""}</Button>
      </div>
      {groups.length ? <p className="mb-3 text-xs text-[#8b919a]">Groups: {groups.join(", ")}</p> : null}
      {view === "table" ? (
        <div className="overflow-auto rounded-2xl bg-white shadow-card">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-[#98a1ab]"><tr>{["", "Name", "Company", "Title", "Email", "Mobile", "Tags"].map((heading) => <th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}</tr></thead>
            <tbody>
              {(contacts.data ?? []).map((contact) => (
                <tr key={contact.id} className="border-t border-[#f4f6f9]">
                  <td className="px-4 py-3"><input type="checkbox" checked={selected.includes(contact.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, contact.id] : selected.filter((id) => id !== contact.id))} /></td>
                  <td className="px-4 py-3 font-medium">{contact.name}</td>
                  <td className="px-4 py-3">{contact.company}</td>
                  <td className="px-4 py-3">{contact.jobTitle}</td>
                  <td className="px-4 py-3">{contact.email}</td>
                  <td className="px-4 py-3">{contact.mobile}</td>
                  <td className="px-4 py-3">{contact.tags.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={view === "grid" ? "grid gap-3 md:grid-cols-3" : "space-y-3"}>
          {(contacts.data ?? []).map((contact) => (
            <div key={contact.id} className="rounded-2xl bg-white p-4 shadow-card">
              <div className="font-semibold">{contact.name}</div>
              <div className="text-sm text-[#66707c]">{contact.jobTitle} · {contact.company}</div>
              <div className="mt-2 text-sm">{contact.email}</div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={open} title="New contact" onClose={() => setOpen(false)}>
        <div className="grid gap-3">
          {(["name", "company", "jobTitle", "email", "mobile", "groupName", "tags"] as const).map((key) => (
            <Field key={key} label={key}><input className={controlClass} value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></Field>
          ))}
          <Button onClick={() => save.mutate()}>Save contact</Button>
        </div>
      </Dialog>
    </div>
  );
}
