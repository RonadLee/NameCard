"use client";

import { Sheet } from "@/components/mobile-frame";
import { api } from "@/lib/api";
import { holderHref, readHolder } from "@/lib/holder";
import { editMobileContacts, type HolderInfinite, type HolderPage } from "@/lib/mobile-cache";
import { useSession } from "@/lib/store";
import type { Contact, ScanItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, MoreHorizontal, Plus, ScanLine, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const pageSize = 24;
const dateHeight = 34;
const cardHeight = 92;

type Groups = { all: number; ungrouped: number; groups: { name: string; count: number }[] };
type Line = { key: string; height: number; date?: string; contact?: Contact };

export function MobileHolder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = readHolder(searchParams);
  const toast = useSession((state) => state.toast);
  const queryClient = useQueryClient();
  const [text, setText] = useState(state.q);
  const [menu, setMenu] = useState<Contact | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [manage, setManage] = useState(false);
  const [note, setNote] = useState<Contact | null>(null);
  const [noteText, setNoteText] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const loadingMore = useRef(false);
  const qRef = useRef(state.q);
  const stateRef = useRef(state);
  qRef.current = state.q;
  stateRef.current = state;

  useEffect(() => setText(state.q), [state.q]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = text.trim();
      if (next === qRef.current) return;
      router.replace(holderHref({ ...stateRef.current, q: next, page: 1 }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [text, router]);

  const list = useInfiniteQuery({
    queryKey: ["cardholder-mobile", state.scope, state.group, state.q],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ page: String(pageParam), pageSize: String(pageSize), sort: "created", scope: state.scope });
      if (state.group) params.set("group", state.group);
      if (state.q) params.set("q", state.q);
      return api<HolderPage>(`/contacts?${params}`);
    },
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    refetchInterval: 4000,
  });
  const groups = useQuery({ queryKey: ["contact-groups", state.scope], queryFn: () => api<Groups>(`/contacts/groups?scope=${state.scope}`), refetchInterval: 4000 });
  const scans = useQuery({ queryKey: ["scans"], queryFn: () => api<ScanItem[]>("/scans"), refetchInterval: 4000 });
  const items = useMemo(() => list.data?.pages.flatMap((page) => page.items) ?? [], [list.data]);
  const total = list.data?.pages[0]?.total ?? groups.data?.all ?? 0;
  const recognizing = (scans.data ?? []).filter((scan) => scan.status === "REVIEW").length;
  const lines = useMemo(() => buildLines(items), [items]);
  const tops = useMemo(() => prefix(lines), [lines]);
  const [range, setRange] = useState({ start: 0, end: 12 });

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    let frame = 0;
    const update = () => {
      const top = node.scrollTop;
      const bottom = top + node.clientHeight;
      let start = 0;
      while (start < lines.length && tops[start] + lines[start].height < top) start += 1;
      start = Math.max(0, start - 4);
      let end = start;
      while (end < lines.length && tops[end] < bottom + 240) end += 1;
      end = Math.min(lines.length, end + 4);
      setRange((current) => (current.start === start && current.end === end ? current : { start, end }));
      const nearEnd = node.scrollHeight - node.scrollTop - node.clientHeight < 360;
      if ((nearEnd || node.scrollHeight <= node.clientHeight + 8) && list.hasNextPage && !list.isFetchingNextPage && !list.isLoading && !loadingMore.current) {
        loadingMore.current = true;
        void list.fetchNextPage().finally(() => {
          loadingMore.current = false;
        });
      }
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    node.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(onScroll);
    observer.observe(node);
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [lines, tops, list.hasNextPage, list.isFetchingNextPage, list.isLoading, list.fetchNextPage]);

  function patch(id: string, map: (contact: Contact) => Contact | null) {
    queryClient.setQueriesData<HolderInfinite>({ queryKey: ["cardholder-mobile"] }, (current) => editMobileContacts(current, id, map));
  }

  const favorite = useMutation({
    mutationFn: (contact: Contact) => api(`/contacts/${contact.id}`, { method: "PATCH", body: JSON.stringify({ name: contact.name, favorite: !contact.favorite }) }),
    onMutate: async (contact) => {
      await queryClient.cancelQueries({ queryKey: ["cardholder-mobile"] });
      const previous = queryClient.getQueriesData<HolderInfinite>({ queryKey: ["cardholder-mobile"] });
      patch(contact.id, (item) => ({ ...item, favorite: !item.favorite }));
      return { previous };
    },
    onError: (error, _contact, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast(error instanceof Error ? error.message : "Could not update the card", "err");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cardholder-mobile"] });
      await queryClient.invalidateQueries({ queryKey: ["cardholder"] });
    },
  });

  const remove = useMutation({
    mutationFn: (contact: Contact) => api(`/contacts/${contact.id}`, { method: "DELETE" }),
    onMutate: async (contact) => {
      await queryClient.cancelQueries({ queryKey: ["cardholder-mobile"] });
      const previous = queryClient.getQueriesData<HolderInfinite>({ queryKey: ["cardholder-mobile"] });
      patch(contact.id, () => null);
      setMenu(null);
      return { previous };
    },
    onError: (error, _contact, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast(error instanceof Error ? error.message : "Could not delete the card", "err");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cardholder-mobile"] });
      await queryClient.invalidateQueries({ queryKey: ["cardholder"] });
      await queryClient.invalidateQueries({ queryKey: ["contact-groups"] });
    },
  });

  const saveNote = useMutation({
    mutationFn: () => api(`/contacts/${note?.id}`, { method: "PATCH", body: JSON.stringify({ name: note?.name, notes: noteText }) }),
    onMutate: async () => {
      if (!note) return;
      await queryClient.cancelQueries({ queryKey: ["cardholder-mobile"] });
      const previous = queryClient.getQueriesData<HolderInfinite>({ queryKey: ["cardholder-mobile"] });
      const id = note.id;
      const value = noteText;
      patch(id, (item) => ({ ...item, notes: value }));
      setNote(null);
      return { previous };
    },
    onError: (error, _value, context) => {
      context?.previous?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast(error instanceof Error ? error.message : "Could not save the note", "err");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cardholder-mobile"] });
      await queryClient.invalidateQueries({ queryKey: ["cardholder"] });
    },
  });

  const label = state.group === "-" ? "Ungrouped" : state.group || "All Cards";
  const topPad = range.start > 0 ? tops[range.start] : 0;
  const shown = lines.slice(range.start, range.end);
  const bottomPad = Math.max(0, (tops.at(-1) ?? 0) + (lines.at(-1)?.height ?? 0) - (shown.length ? tops[range.end - 1] + lines[range.end - 1].height : 0));

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between px-4 pb-2 pt-3">
        <Link href="/settings" aria-label="Notifications" className="text-[#3d4550]"><Bell size={22} /></Link>
        <h1 className="text-lg font-semibold">CardHolder</h1>
        <Link href={holderHref(state).replace("/cardholder", "/cardholder/new")} aria-label="Add card" className="grid h-8 w-8 place-items-center rounded-full border border-[#d7dde6]"><Plus size={18} /></Link>
      </header>
      <form className="mx-4 flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-sm" onSubmit={(event) => event.preventDefault()}>
        <Search size={16} className="text-[#b0b6be]" />
        <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Search" aria-label="Search cards" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </form>
      <div className="flex items-center gap-2 px-4 py-3 text-sm">
        <span className="font-medium">{label} {total}</span>
        <button type="button" className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg border border-[#e1e5ec] bg-white px-3" onClick={() => setGroupOpen(true)}>Group</button>
        <button type="button" className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#e1e5ec] bg-white px-3" onClick={() => setManage(true)}>Manage</button>
      </div>
      {recognizing ? (
        <Link href="/scan" className="mx-4 mb-2 flex items-center gap-2 rounded-xl bg-[#e7f3ff] px-3 py-2 text-sm text-[#1a73c7]">
          <ScanLine size={16} /> {recognizing} card{recognizing === 1 ? "" : "s"} being recognized...
          <span className="ml-auto">›</span>
        </Link>
      ) : null}
      <div ref={scroller} data-testid="mobile-card-list" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {list.isLoading ? <Skeletons /> : lines.length === 0 ? <p className="px-4 py-16 text-center text-sm text-[#8b919a]">No cards in this view.</p> : (
          <div style={{ paddingTop: topPad, paddingBottom: bottomPad }}>
            {shown.map((line) => line.date ? (
              <div key={line.key} className="px-4 text-xs leading-[34px] text-[#98a1ab]">{line.date}</div>
            ) : line.contact ? (
              <div key={line.key} className="flex h-[92px] items-center gap-3 border-b border-[#eef1f5] px-4">
                <button type="button" data-testid="mobile-card-row" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => router.push(holderHref(state, line.contact?.id))}>
                  <Thumb contact={line.contact} />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold">{line.contact.name}</span>
                    <span className="block truncate text-xs text-[#66707c]">{line.contact.jobTitle || "—"}</span>
                    <span className="block truncate text-xs text-[#98a1ab]">{line.contact.company || "—"}</span>
                  </span>
                </button>
                <button type="button" aria-label={`Actions for ${line.contact.name}`} className="grid h-8 w-8 shrink-0 place-items-center text-[#98a1ab]" onClick={() => setMenu(line.contact || null)}><MoreHorizontal size={18} /></button>
              </div>
            ) : null)}
          </div>
        )}
        {list.isFetchingNextPage ? <p className="py-3 text-center text-xs text-[#98a1ab]">Loading more cards…</p> : null}
      </div>
      {menu ? (
        <Sheet title={menu.name} onClose={() => setMenu(null)}>
          <div className="grid gap-2 pb-2">
            <button type="button" className="h-11 rounded-xl bg-[#f6f7f9] text-sm" onClick={() => { setNote(menu); setNoteText(menu.notes || ""); setMenu(null); }}>Note</button>
            <button type="button" className="h-11 rounded-xl bg-[#f6f7f9] text-sm" onClick={() => favorite.mutate(menu)}> {menu.favorite ? "Remove star" : "Star"}</button>
            <Link href={`/cardholder/${menu.id}/edit${searchParams.toString() ? `?${searchParams}` : ""}`} className="grid h-11 place-items-center rounded-xl bg-[#f6f7f9] text-sm" onClick={() => setMenu(null)}>Edit</Link>
            <button type="button" className="h-11 rounded-xl bg-[#fff1f0] text-sm text-[#c2413b]" onClick={() => { if (window.confirm(`Delete ${menu.name}?`)) remove.mutate(menu); }}>Delete</button>
          </div>
        </Sheet>
      ) : null}
      {note ? (
        <Sheet title="Note" onClose={() => setNote(null)}>
          <textarea className="h-28 w-full rounded-xl border border-[#e6e9ef] p-3 text-sm outline-none" value={noteText} onChange={(event) => setNoteText(event.target.value)} />
          <button type="button" className="mt-3 h-11 w-full rounded-full bg-[#1a9fff] text-sm font-medium text-white" onClick={() => saveNote.mutate()}>Save</button>
        </Sheet>
      ) : null}
      {groupOpen ? (
        <Sheet title="Group" onClose={() => setGroupOpen(false)}>
          <GroupButton active={!state.group} label={`All Cards ${groups.data?.all ?? total}`} onClick={() => { router.replace(holderHref({ ...state, group: "", page: 1 })); setGroupOpen(false); }} />
          <GroupButton active={state.group === "-"} label={`Ungrouped ${groups.data?.ungrouped ?? 0}`} onClick={() => { router.replace(holderHref({ ...state, group: "-", page: 1 })); setGroupOpen(false); }} />
          {(groups.data?.groups ?? []).map((group) => (
            <GroupButton key={group.name} active={state.group === group.name} label={`${group.name} ${group.count}`} onClick={() => { router.replace(holderHref({ ...state, group: group.name, page: 1 })); setGroupOpen(false); }} />
          ))}
        </Sheet>
      ) : null}
      {manage ? <ManageSheet scope={state.scope} groups={groups.data} onClose={() => setManage(false)} onScope={(scope) => router.replace(holderHref({ ...state, scope, group: "", page: 1 }))} /> : null}
    </div>
  );
}

function GroupButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" className={cn("mb-2 block h-11 w-full rounded-xl px-3 text-left text-sm", active ? "bg-[#e7f3ff] font-medium" : "bg-[#f6f7f9]")} onClick={onClick}>{label}</button>;
}

function ManageSheet({ scope, groups, onClose, onScope }: { scope: "mine" | "company"; groups?: Groups; onClose: () => void; onScope: (scope: "mine" | "company") => void }) {
  const toast = useSession((state) => state.toast);
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["contact-groups"] });
    await queryClient.invalidateQueries({ queryKey: ["cardholder-mobile"] });
  }
  return (
    <Sheet title="Manage" onClose={onClose}>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button type="button" className={cn("h-10 rounded-xl text-sm", scope === "mine" ? "bg-[#1a9fff] text-white" : "bg-[#f6f7f9]")} onClick={() => onScope("mine")}>My cards</button>
        <button type="button" className={cn("h-10 rounded-xl text-sm", scope === "company" ? "bg-[#1a9fff] text-white" : "bg-[#f6f7f9]")} onClick={() => onScope("company")}>Company</button>
      </div>
      <form className="mb-3 flex gap-2" onSubmit={async (event) => {
        event.preventDefault();
        try {
          await api("/contacts/groups", { method: "POST", body: JSON.stringify({ name }) });
          setName("");
          await refresh();
          toast("Group created");
        } catch (error) {
          toast(error instanceof Error ? error.message : "Could not create the group", "err");
        }
      }}>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="New group" className="h-10 min-w-0 flex-1 rounded-xl border border-[#e6e9ef] px-3 text-sm outline-none" />
        <button className="h-10 rounded-xl bg-[#1a9fff] px-3 text-sm text-white" type="submit">Add</button>
      </form>
      {(groups?.groups ?? []).map((group) => (
        <div key={group.name} className="flex items-center gap-2 border-b border-[#f4f6f9] py-2 text-sm">
          <span className="min-w-0 flex-1 truncate">{group.name} · {group.count}</span>
          <button type="button" className="text-[#1a9fff]" onClick={async () => {
            const to = window.prompt("Rename group", group.name)?.trim();
            if (!to || to === group.name) return;
            await api("/contacts/groups", { method: "PATCH", body: JSON.stringify({ from: group.name, to }) });
            await refresh();
          }}>Rename</button>
          <button type="button" className="text-[#c2413b]" onClick={async () => {
            if (group.count > 0 && !window.confirm(`${group.name} is used by ${group.count} cards. Remove the group? The cards stay in the cardholder.`)) return;
            await api(`/contacts/groups?name=${encodeURIComponent(group.name)}`, { method: "DELETE" });
            await refresh();
            toast("Group removed");
          }}>Delete</button>
        </div>
      ))}
    </Sheet>
  );
}

function Thumb({ contact }: { contact: Contact }) {
  const src = contact.cardImageUrl || contact.imageUrl;
  if (src) return <img src={src} alt="" className="h-12 w-[72px] shrink-0 rounded-md border border-[#eceff3] object-cover" />;
  return <span className="grid h-12 w-[72px] shrink-0 place-items-center rounded-md bg-[#eef3f8] text-xs font-semibold text-[#5c6b7a]">{initials(contact.name)}</span>;
}

function Skeletons() {
  return (
    <div>
      {Array.from({ length: 6 }, (_, index) => <div key={index} className="mx-4 my-3 h-16 animate-pulse rounded-xl bg-white" />)}
    </div>
  );
}

function buildLines(items: Contact[]) {
  const lines: Line[] = [];
  let last = "";
  for (const contact of items) {
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(contact.createdAt));
    if (date !== last) {
      lines.push({ key: `date-${date}`, height: dateHeight, date });
      last = date;
    }
    lines.push({ key: contact.id, height: cardHeight, contact });
  }
  return lines;
}

function prefix(lines: Line[]) {
  const tops: number[] = [];
  let y = 0;
  for (const line of lines) {
    tops.push(y);
    y += line.height;
  }
  return tops;
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "NC";
}
