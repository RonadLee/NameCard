"use client";

import { Sheet } from "@/components/mobile-frame";
import { api } from "@/lib/api";
import { holderHref, readHolder } from "@/lib/holder";
import { editMobileContacts, type HolderInfinite } from "@/lib/mobile-cache";
import { useSession } from "@/lib/store";
import type { Contact } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, MapPin, MoreHorizontal, Pencil, Phone, Star, StickyNote } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function MobileDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = readHolder(searchParams);
  const toast = useSession((store) => store.toast);
  const queryClient = useQueryClient();
  const contactQuery = useQuery({ queryKey: ["contact", params.id], queryFn: () => api<Contact>(`/contacts/${params.id}`), staleTime: 15_000 });
  const groups = useQuery({ queryKey: ["contact-groups", state.scope], queryFn: () => api<{ groups: { name: string; count: number }[] }>(`/contacts/groups?scope=${state.scope}`), staleTime: 15_000 });
  const [slide, setSlide] = useState(0);
  const [menu, setMenu] = useState(false);
  const [grouping, setGrouping] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const contact = contactQuery.data;

  function remember(next: Contact | null) {
    queryClient.setQueryData(["contact", params.id], next);
    queryClient.setQueriesData<HolderInfinite>({ queryKey: ["cardholder-mobile"] }, (current) => editMobileContacts(current, params.id, () => next));
  }

  const favorite = useMutation({
    mutationFn: (row: Contact) => api(`/contacts/${row.id}`, { method: "PATCH", body: JSON.stringify({ name: row.name, favorite: !row.favorite }) }),
    onMutate: async (row) => {
      await queryClient.cancelQueries({ queryKey: ["contact", row.id] });
      const previous = queryClient.getQueryData<Contact>(["contact", row.id]);
      if (previous) remember({ ...previous, favorite: !previous.favorite });
      return { previous };
    },
    onError: (error, row, context) => {
      if (context?.previous) remember(context.previous);
      toast(error instanceof Error ? error.message : "Could not update the card", "err");
      void row;
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["contact", params.id] }),
  });

  const remove = useMutation({
    mutationFn: () => api(`/contacts/${params.id}`, { method: "DELETE" }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["cardholder-mobile"] });
      const previous = queryClient.getQueriesData<HolderInfinite>({ queryKey: ["cardholder-mobile"] });
      queryClient.setQueriesData<HolderInfinite>({ queryKey: ["cardholder-mobile"] }, (current) => editMobileContacts(current, params.id, () => null));
      return { previous };
    },
    onSuccess: () => router.replace(holderHref(state)),
    onError: (error, _value, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast(error instanceof Error ? error.message : "Could not delete the card", "err");
    },
  });

  const saveNote = useMutation({
    mutationFn: () => api(`/contacts/${params.id}`, { method: "PATCH", body: JSON.stringify({ name: contact?.name, notes: noteText }) }),
    onMutate: async () => {
      const previous = contact;
      if (previous) remember({ ...previous, notes: noteText });
      setEditingNote(false);
      return { previous };
    },
    onError: (error, _value, context) => {
      if (context?.previous) remember(context.previous);
      toast(error instanceof Error ? error.message : "Could not save the note", "err");
    },
  });

  const addGroup = useMutation({
    mutationFn: (name: string) => api("/contacts/categorize", { method: "POST", body: JSON.stringify({ ids: [params.id], groupName: name }) }),
    onMutate: async (name) => {
      const previous = contact;
      if (previous) {
        const groups = Array.from(new Set([...(previous.groups ?? []), previous.groupName || "", name].filter(Boolean)));
        remember({ ...previous, groups, groupName: previous.groupName || name });
      }
      setGrouping(false);
      return { previous };
    },
    onError: (error, _name, context) => {
      if (context?.previous) remember(context.previous);
      toast(error instanceof Error ? error.message : "Could not add the group", "err");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contact", params.id] });
      await queryClient.invalidateQueries({ queryKey: ["contact-groups"] });
    },
  });

  if (!contact) {
    return <div className="grid min-h-0 flex-1 place-items-center text-sm text-[#8b919a]">{contactQuery.isError ? "Card not found" : "Loading card…"}</div>;
  }

  const images = [contact.cardImageUrl, contact.cardBackUrl, contact.imageUrl].filter((url): url is string => Boolean(url));
  const unique = Array.from(new Set(images));
  const phone = firstLine(contact.mobile || contact.phone || "");
  const fax = contact.details?.faxes?.[0] || "";
  const email = contact.email || contact.details?.emails?.[0] || "";
  const address = contact.address || contact.details?.addresses?.[0]?.street || "";
  const groupLabel = (contact.groups?.length ? contact.groups : contact.groupName ? [contact.groupName] : []).join(", ");
  const received = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Shanghai" }).format(new Date(contact.createdAt));
  const query = searchParams.toString();

  async function share() {
    const text = [contact?.name, contact?.jobTitle, contact?.company, phone, email, address].filter(Boolean).join("\n");
    if (navigator.share) {
      await navigator.share({ title: contact?.name, text }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(text);
    toast("Card copied");
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#f3f5f8]">
      <header className="sticky top-0 z-20 flex items-center gap-2 bg-[#17324d] px-2 py-3 text-white">
        <button type="button" aria-label="Back" className="grid h-9 w-9 place-items-center" onClick={() => router.push(holderHref(state))}><ChevronLeft /></button>
        <h1 className="flex-1 text-center text-base font-medium">Card Details</h1>
        <button type="button" aria-label={contact.favorite ? "Remove star" : "Star"} className="grid h-9 w-9 place-items-center" onClick={() => favorite.mutate(contact)}><Star size={18} className={contact.favorite ? "fill-white" : ""} /></button>
        <button type="button" aria-label="More" className="grid h-9 w-9 place-items-center" onClick={() => setMenu(true)}><MoreHorizontal size={18} /></button>
      </header>
      <div className="bg-white">
        {unique.length ? (
          <img src={unique[Math.min(slide, unique.length - 1)]} alt="" className="max-h-64 w-full object-contain" />
        ) : (
          <div className="grid h-40 place-items-center text-sm text-[#98a1ab]">No card image</div>
        )}
        {unique.length > 1 ? (
          <div className="flex justify-center gap-1 py-2">
            {unique.map((url, index) => <button key={url} aria-label={`Image ${index + 1}`} className={`h-1.5 w-1.5 rounded-full ${index === slide ? "bg-[#1a9fff]" : "bg-[#d5dbe3]"}`} onClick={() => setSlide(index)} />)}
          </div>
        ) : null}
      </div>
      <div className="relative z-10 mx-4 -mt-6 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#eef3f8] text-sm font-semibold text-[#5c6b7a]">{initials(contact.name)}</span>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold">{contact.name}</div>
            <div className="truncate text-xs text-[#66707c]">{contact.jobTitle || "—"}</div>
            <div className="truncate text-xs text-[#98a1ab]">{contact.company || "—"}</div>
          </div>
        </div>
        {phone ? <p className="mt-3 text-sm">{phone}</p> : null}
        {address ? <p className="mt-1 text-sm text-[#66707c]">{address}</p> : null}
      </div>
      <div className="sticky top-[52px] z-10 mt-4 grid grid-cols-4 bg-[#f3f5f8] px-4 py-2">
        <Action icon={Phone} label="Phone" onClick={() => phone ? window.location.href = `tel:${phone.replace(/\s/g, "")}` : toast("No phone number on this card", "err")} />
        <Action icon={MapPin} label="Address" onClick={() => address ? window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, "_blank", "noopener") : toast("No address on this card", "err")} />
        <Action icon={StickyNote} label="Note" onClick={() => { setNoteText(contact.notes || ""); setEditingNote(true); }} />
        <Link href={`/cardholder/${contact.id}/edit${query ? `?${query}` : ""}`} className="grid place-items-center gap-1 text-[11px] text-[#3d4550]"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#22c55e] text-white"><Pencil size={16} /></span>Edit</Link>
      </div>
      <div className="mx-4 mt-2 overflow-hidden rounded-2xl bg-white">
        <button type="button" className="flex w-full items-center gap-3 border-b border-[#f4f6f9] px-4 py-3 text-left text-sm" onClick={() => setGrouping(true)}>
          <span className="text-[#98a1ab]">Group:</span>
          <span className="min-w-0 flex-1 truncate">{groupLabel || "Ungrouped"}</span>
          <span className="text-[#c5ccd4]">›</span>
        </button>
        <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm" onClick={() => { setNoteText(contact.notes || ""); setEditingNote(true); }}>
          <span className="text-[#98a1ab]">Note:</span>
          <span className="min-w-0 flex-1 truncate">{contact.notes || `${received} · ${sourceLabel(contact.source)}`}</span>
          <span className="text-[#c5ccd4]">›</span>
        </button>
      </div>
      <div className="mx-4 mt-3 overflow-hidden rounded-2xl bg-white">
        <Field icon={Phone} value={phone} caption="Work Tel" />
        <Field icon={Phone} value={fax} caption="Work Fax" />
        <Field icon={StickyNote} value={email} caption="Work Email" href={email ? `mailto:${email}` : undefined} />
        <Field icon={MapPin} value={address} caption="Company Address" />
        <Field icon={MapPin} value={contact.details?.addresses?.[0]?.country || ""} caption="Company Address" />
        <div className="flex items-start gap-3 px-4 py-3">
          <span className="mt-0.5 text-[#98a1ab]">▣</span>
          <div className="min-w-0">
            <div className="text-sm">{contact.company || "—"}</div>
            <div className="text-xs text-[#98a1ab]">{contact.jobTitle || "Company"}</div>
          </div>
        </div>
      </div>
      <div className="sticky bottom-0 px-4 py-4" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
        <button type="button" data-testid="mobile-share-card" className="h-12 w-full rounded-full bg-[#1a9fff] text-base font-medium text-white" onClick={() => void share()}>Share Card</button>
      </div>
      {menu ? (
        <Sheet title="Card" onClose={() => setMenu(false)}>
          <button type="button" className="h-11 w-full rounded-xl bg-[#fff1f0] text-sm text-[#c2413b]" onClick={() => { if (window.confirm(`Delete ${contact.name}?`)) remove.mutate(); }}>Delete</button>
        </Sheet>
      ) : null}
      {grouping ? (
        <Sheet title="Add to group" onClose={() => setGrouping(false)}>
          {(groups.data?.groups ?? []).map((group) => (
            <button key={group.name} type="button" className="mb-2 block h-11 w-full rounded-xl bg-[#f6f7f9] px-3 text-left text-sm" onClick={() => addGroup.mutate(group.name)}>{group.name}</button>
          ))}
          {(groups.data?.groups ?? []).length === 0 ? <p className="text-sm text-[#8b919a]">Create a group from CardHolder, then add this card.</p> : null}
        </Sheet>
      ) : null}
      {editingNote ? (
        <Sheet title="Note" onClose={() => setEditingNote(false)}>
          <textarea className="h-28 w-full rounded-xl border border-[#e6e9ef] p-3 text-sm outline-none" value={noteText} onChange={(event) => setNoteText(event.target.value)} />
          <button type="button" className="mt-3 h-11 w-full rounded-full bg-[#1a9fff] text-sm font-medium text-white" onClick={() => saveNote.mutate()}>Save</button>
        </Sheet>
      ) : null}
    </div>
  );
}

function Action({ icon: Icon, label, onClick }: { icon: typeof Phone; label: string; onClick: () => void }) {
  const color = label === "Phone" ? "bg-[#3b82f6]" : label === "Address" ? "bg-[#f5b942]" : "bg-[#4ade80]";
  return (
    <button type="button" className="grid place-items-center gap-1 text-[11px] text-[#3d4550]" onClick={onClick}>
      <span className={`grid h-11 w-11 place-items-center rounded-full text-white ${color}`}><Icon size={16} /></span>
      {label}
    </button>
  );
}

function Field({ icon: Icon, value, caption, href }: { icon: typeof Phone; value: string; caption: string; href?: string }) {
  if (!value) return null;
  const body = (
    <>
      <Icon size={16} className="mt-0.5 shrink-0 text-[#98a1ab]" />
      <span className="min-w-0">
        <span className="block break-all text-sm">{value}</span>
        <span className="block text-xs text-[#98a1ab]">{caption}</span>
      </span>
    </>
  );
  if (href) return <a href={href} className="flex items-start gap-3 border-b border-[#f4f6f9] px-4 py-3">{body}</a>;
  return <div className="flex items-start gap-3 border-b border-[#f4f6f9] px-4 py-3">{body}</div>;
}

function firstLine(value: string) {
  return value.split("\n")[0]?.trim() || "";
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "NC";
}

function sourceLabel(source: string) {
  if (source === "scan") return "Taking photo";
  if (source === "qr") return "Shared card";
  if (source === "manual") return "Added manually";
  return source;
}
