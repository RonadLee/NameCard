"use client";

import { Button, controlClass, PageTitle } from "@/components/ui";
import { api } from "@/lib/api";
import { useSession } from "@/lib/store";
import type { Contact } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useMemo, useState } from "react";

export default function CardholderPage() {
  const toast = useSession((state) => state.toast);
  const queryClient = useQueryClient();
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: () => api<Contact[]>("/contacts") });
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [drag, setDrag] = useState<{ id: string; x: number } | null>(null);
  const tags = useMemo(() => Array.from(new Set((contacts.data ?? []).flatMap((contact) => contact.tags))), [contacts.data]);
  const rows = (contacts.data ?? []).filter((contact) => {
    const haystack = `${contact.name} ${contact.company} ${contact.email}`.toLowerCase();
    return haystack.includes(q.toLowerCase()) && (!tag || contact.tags.includes(tag));
  });
  const favorite = useMutation({
    mutationFn: (contact: Contact) => api(`/contacts/${contact.id}`, { method: "PATCH", body: JSON.stringify({ name: contact.name, favorite: !contact.favorite }) }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["contacts"] }),
    onError: (error) => toast(error instanceof Error ? error.message : "Could not update", "err"),
  });

  return (
    <div>
      <PageTitle title="Cardholder" extra={<span className="text-sm text-[#8b919a]">{rows.length} saved</span>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <input className={`${controlClass} max-w-sm`} placeholder="Search cards" value={q} onChange={(event) => setQ(event.target.value)} />
        <button className={`rounded-full px-3 py-2 text-sm ${tag === "" ? "bg-[#1aa3e8] text-white" : "bg-white"}`} onClick={() => setTag("")}>All</button>
        {tags.map((item) => <button key={item} className={`rounded-full px-3 py-2 text-sm ${tag === item ? "bg-[#1aa3e8] text-white" : "bg-white"}`} onClick={() => setTag(item)}>{item}</button>)}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((contact) => (
          <article
            key={contact.id}
            className="rounded-2xl bg-white p-4 shadow-card"
            style={{ transform: drag?.id === contact.id ? `translateX(${drag.x}px)` : undefined }}
            onPointerDown={(event) => setDrag({ id: contact.id, x: 0 })}
            onPointerMove={(event) => drag?.id === contact.id && setDrag({ id: contact.id, x: Math.max(-120, Math.min(120, event.movementX + drag.x)) })}
            onPointerUp={() => {
              if (drag && Math.abs(drag.x) > 70) favorite.mutate(contact);
              setDrag(null);
            }}
          >
            {contact.cardImageUrl ? <img src={contact.cardImageUrl} alt="" className="mb-3 h-28 w-full rounded-xl object-cover" /> : null}
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{contact.name}</div>
                <div className="text-sm text-[#66707c]">{contact.jobTitle}</div>
                <div className="text-sm text-[#8b919a]">{contact.company}</div>
              </div>
              <button aria-label="Favorite" onClick={() => favorite.mutate(contact)} className={contact.favorite ? "text-[#f5b942]" : "text-[#c5ccd4]"}><Star size={18} fill={contact.favorite ? "currentColor" : "none"} /></button>
            </div>
            <div className="mt-3 text-xs text-[#66707c]">{contact.email}<br />{contact.mobile}</div>
            <div className="mt-3 flex gap-1">{contact.tags.map((item) => <span key={item} className="rounded-full bg-[#f3f5f7] px-2 py-1 text-[11px]">{item}</span>)}</div>
          </article>
        ))}
      </div>
      {!rows.length ? <div className="mt-16 text-center text-sm text-[#b0b6be]">No saved cards yet. Scan one to fill the wallet.</div> : null}
      <p className="mt-4 text-xs text-[#98a1ab]">Swipe a card sideways to favorite it.</p>
      <Button className="sr-only">Holder</Button>
    </div>
  );
}
