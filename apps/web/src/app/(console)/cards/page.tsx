"use client";

import { CardFace, publicUrl } from "@/components/card-face";
import { Button, Dialog, PageTitle } from "@/components/ui";
import { api } from "@/lib/api";
import { useSession } from "@/lib/store";
import type { Card } from "@/lib/types";
import { toPng } from "html-to-image";
import { useQuery } from "@tanstack/react-query";
import { Copy, Pencil, Plus, Share2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import QRCode from "qrcode";

export default function CardsPage() {
  const [archived, setArchived] = useState(false);
  const cards = useQuery({ queryKey: ["cards", archived], queryFn: () => api<Card[]>(`/cards${archived ? "?archived=1" : ""}`) });
  const [share, setShare] = useState<Card | null>(null);

  return (
    <div>
      <PageTitle
        title="My Cards"
        action={<Link href="/cards/new" className="grid h-7 w-7 place-items-center rounded-full border border-[#e6e8ee] bg-white text-[#3d4550]" aria-label="Create card"><Plus size={16} /></Link>}
        extra={<button className="text-sm text-[#1aa3e8]" onClick={() => setArchived((value) => !value)}>{archived ? "Show active" : "Show archived"}</button>}
      />
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {(cards.data ?? []).map((card) => (
          <article key={card.id} className="rounded-[20px] bg-white p-4 shadow-card">
            <CardFace card={card} />
            <div className="mt-4 flex items-center justify-end gap-2">
              <Link href={`/cards/${card.id}`} className="inline-flex h-9 items-center gap-1 rounded-full border border-[#e4e7ec] px-4 text-sm"><Pencil size={14} /> Edit</Link>
              <button className="inline-flex h-9 items-center gap-1 rounded-full bg-[#1aa3e8] px-4 text-sm font-medium text-white" onClick={() => setShare(card)}><Share2 size={14} /> share</button>
            </div>
          </article>
        ))}
        <Link href="/cards/new" className="grid min-h-[250px] place-items-center rounded-[20px] bg-white shadow-card">
          <span className="grid place-items-center gap-3 text-sm">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[#f3f5f7] text-xl text-[#98a1ab]">+</span>
            Create New Card
          </span>
        </Link>
      </div>
      <ShareDialog card={share} onClose={() => setShare(null)} />
    </div>
  );
}

export function ShareDialog({ card, onClose }: { card: Card | null; onClose: () => void }) {
  const toast = useSession((state) => state.toast);
  const face = useRef<HTMLDivElement>(null);
  const [qr, setQr] = useState("");
  const link = card ? publicUrl(card.qrSlug) : "";

  async function openQr() {
    if (!card) return;
    setQr(await QRCode.toDataURL(link, { margin: 1, width: 280 }));
    await api(`/cards/${card.id}/share`, { method: "POST", body: JSON.stringify({ channel: "link" }) });
  }

  return (
    <Dialog open={Boolean(card)} title="Share card" onClose={onClose}>
      {card ? (
        <div className="space-y-4">
          <div ref={face}><CardFace card={card} /></div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={openQr}>Generate QR</Button>
            <Button variant="ghost" onClick={() => { void navigator.clipboard.writeText(link); toast("Link copied"); }}><Copy size={14} /> Copy link</Button>
            <Button variant="ghost" onClick={() => downloadPng(face.current, card.name)}>Download image</Button>
            <Button variant="ghost" onClick={() => downloadPdf(card)}>Download PDF</Button>
          </div>
          {qr ? <img src={qr} alt="Card QR code" className="mx-auto h-40 w-40" /> : null}
          <div className="flex gap-2 text-sm">
            <a className="text-[#1aa3e8]" href={`mailto:?subject=${encodeURIComponent(card.name)}&body=${encodeURIComponent(link)}`}>Email</a>
            <a className="text-[#1aa3e8]" href={`https://wa.me/?text=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer">WhatsApp</a>
            <a className="text-[#1aa3e8]" href={link} target="_blank" rel="noreferrer">Preview</a>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

async function downloadPng(node: HTMLElement | null, name: string) {
  if (!node) return;
  const url = await toPng(node, { pixelRatio: 2 });
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.png`;
  link.click();
}

async function downloadPdf(card: Card) {
  const body = await api<{ base64: string }>(`/cards/${card.id}/pdf`);
  const bytes = Uint8Array.from(atob(body.base64), (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${card.name}.pdf`;
  link.click();
}
