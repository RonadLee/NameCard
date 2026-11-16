"use client";

import { CardFace } from "@/components/card-face";
import { Sheet } from "@/components/mobile-frame";
import { api } from "@/lib/api";
import { publicUrl } from "@/lib/signature";
import { useSession } from "@/lib/store";
import type { Card } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Bell, Crown, Mic, Pencil, QrCode, ScanLine, Search, Share2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SpeechEvent = { results: Array<Array<{ transcript: string }>> };
type SpeechRecognizer = { lang: string; start: () => void; onresult: ((event: SpeechEvent) => void) | null; onerror: (() => void) | null };

export function MobileHome() {
  const router = useRouter();
  const user = useSession((state) => state.user);
  const toast = useSession((state) => state.toast);
  const cards = useQuery({ queryKey: ["cards", false], queryFn: () => api<Card[]>("/cards") });
  const counts = useQuery({ queryKey: ["contact-groups", "mine"], queryFn: () => api<{ all: number }>("/contacts/groups?scope=mine"), refetchInterval: 4000 });
  const [text, setText] = useState("");
  const [share, setShare] = useState<Card | null>(null);
  const [stats, setStats] = useState(false);
  const card = cards.data?.[0];
  const first = user?.name?.split(/\s+/)[0] || "there";

  function search(value: string) {
    const q = value.trim();
    router.push(q ? `/cardholder?q=${encodeURIComponent(q)}` : "/cardholder");
  }

  function listen() {
    const ctor = (window as unknown as { SpeechRecognition?: new () => SpeechRecognizer; webkitSpeechRecognition?: new () => SpeechRecognizer }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognizer }).webkitSpeechRecognition;
    if (!ctor) {
      toast("Speech input is not available in this browser", "err");
      return;
    }
    const recognition = new ctor();
    recognition.lang = "en-US";
    recognition.onresult = (event) => search(event.results[0]?.[0]?.transcript || "");
    recognition.onerror = () => toast("Could not hear that. Try again.", "err");
    recognition.start();
  }

  return (
    <div className="px-4 pb-6">
      <div className="flex items-center gap-3 pt-3">
        <Link href="/settings" aria-label="Notifications" className="text-[#3d4550]"><Bell size={22} /></Link>
        <form className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-3 py-2 shadow-sm" onSubmit={(event) => { event.preventDefault(); search(text); }}>
          <Search size={16} className="text-[#b0b6be]" />
          <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Search Card Holder" className="min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label="Search Card Holder" />
        </form>
        <Link href="/settings?tab=billing" aria-label="Plan" className="text-[#f0b429]"><Crown size={22} /></Link>
        <button type="button" aria-label="Card stats" className="text-[#3d4550]" onClick={() => setStats(true)}><BarChart3 size={22} /></button>
      </div>
      <h1 className="mt-6 text-[28px] font-light leading-tight text-[#66707c]">Hello,</h1>
      <p className="text-[32px] font-semibold leading-tight">{first}</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button type="button" className="rounded-2xl bg-white p-4 text-left shadow-sm" onClick={listen}>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e7f4ff] text-[#1a9fff]"><Mic size={18} /></span>
          <span className="mt-4 block text-sm font-medium">Speech to Text</span>
          <span className="mt-1 block text-xs text-[#98a1ab]">Search by voice</span>
        </button>
        <Link href="/scan?accuracy=high" className="rounded-2xl bg-white p-4 shadow-sm">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f3e9ff] text-[#7a5cff]"><ScanLine size={18} /></span>
          <span className="mt-4 block text-sm font-medium">High Accuracy</span>
          <span className="mt-1 block text-xs text-[#98a1ab]">Bilingual recognition</span>
        </Link>
      </div>
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">My Digital Card</h2>
        <span className="inline-flex items-center gap-1 rounded-full border border-[#e6e9ef] bg-white px-2 py-1 text-xs text-[#66707c]">{cards.data?.length ?? 0}</span>
      </div>
      <div className="mt-3 rounded-3xl bg-white p-3 shadow-sm">
        {card ? <CardFace card={card} /> : <Link href="/cards/new" className="grid h-36 place-items-center text-sm text-[#8b919a]">Create your digital card</Link>}
        <div className="mt-4 flex items-center gap-3 px-1 pb-2">
          <Link href={card ? `/cards/${card.id}` : "/cards/new"} aria-label="Edit digital card" className="grid h-11 w-11 place-items-center rounded-full border border-[#eceff3]"><Pencil size={16} /></Link>
          <button type="button" aria-label="Card QR" className="grid h-11 w-11 place-items-center rounded-full border border-[#eceff3]" onClick={() => card && setShare(card)}><QrCode size={16} /></button>
          <button type="button" data-testid="mobile-share-digital" className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#f4f6f9] text-sm font-medium" onClick={() => card && setShare(card)}><Share2 size={16} /> Share</button>
        </div>
      </div>
      {share ? <ShareSheet card={share} onClose={() => setShare(null)} /> : null}
      {stats ? (
        <Sheet title="Workspace" onClose={() => setStats(false)}>
          <p className="text-sm text-[#66707c]">Digital cards: {cards.data?.length ?? 0}</p>
          <p className="mt-2 text-sm text-[#66707c]">Cardholder: {counts.data?.all ?? 0}</p>
          <Link href="/cardholder" className="mt-4 inline-flex h-10 items-center text-sm font-medium text-[#1a9fff]" onClick={() => setStats(false)}>Open CardHolder</Link>
        </Sheet>
      ) : null}
    </div>
  );
}

function ShareSheet({ card, onClose }: { card: Card; onClose: () => void }) {
  const toast = useSession((state) => state.toast);
  const link = publicUrl(card.qrSlug);
  async function share() {
    const text = [card.name, card.jobTitle, card.company, link].filter(Boolean).join("\n");
    if (navigator.share) {
      await navigator.share({ title: card.name, text, url: link }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(link);
    toast("Link copied");
  }
  return (
    <Sheet title="Share card" onClose={onClose}>
      <p className="break-all text-sm text-[#66707c]">{link}</p>
      <button type="button" className="mt-4 h-11 w-full rounded-full bg-[#1a9fff] text-sm font-medium text-white" onClick={() => void share()}>Share</button>
    </Sheet>
  );
}
