"use client";

import { CardFace } from "@/components/card-face";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";
import { useSession } from "@/lib/store";
import type { Card } from "@/lib/types";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function PublicCardPage() {
  const params = useParams<{ slug: string }>();
  const token = useSession((state) => state.accessToken);
  const toast = useSession((state) => state.toast);
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  useEffect(() => {
    void fetch(`/api/public/cards/${params.slug}`).then(async (res) => {
      if (!res.ok) {
        setError("This card is private or no longer available.");
        return;
      }
      setCard(await res.json());
    });
  }, [params.slug]);
  if (error) return <div className="grid min-h-screen place-items-center text-sm text-[#8b919a]">{error}</div>;
  if (!card) return <div className="grid min-h-screen place-items-center text-sm text-[#8b919a]">Loading card…</div>;
  const vcard = ["BEGIN:VCARD", "VERSION:3.0", `FN:${card.name}`, card.company ? `ORG:${card.company}` : "", card.jobTitle ? `TITLE:${card.jobTitle}` : "", card.email ? `EMAIL:${card.email}` : "", card.mobile ? `TEL;TYPE=CELL:${card.mobile}` : "", card.phone ? `TEL:${card.phone}` : "", card.address ? `ADR:${card.address}` : "", card.website ? `URL:${card.website}` : "", "END:VCARD"].filter(Boolean).join("\n");
  return (
    <div className="grid min-h-screen place-items-center bg-[#f4f6f9] px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-card">
        <CardFace card={card} />
        <div className="mt-5 space-y-1 text-sm text-[#3d4550]">
          <div className="text-xl font-semibold">{card.name}</div>
          {card.nameZh ? <div>{card.nameZh}</div> : null}
          <div>{card.jobTitle}</div>
          <div className="text-[#8b919a]">{card.company}</div>
          <div className="pt-2">{card.mobile}</div>
          <div>{card.email}</div>
          <div>{card.address}</div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
        {token ? <Button onClick={async () => {
          try {
            const result = await api<{ name: string; alreadySaved: boolean }>("/contacts/from-card", { method: "POST", body: JSON.stringify({ slug: card.qrSlug }) });
            setSaved(result.alreadySaved ? `${result.name} is already in your cardholder` : `${result.name} saved to your cardholder`);
            toast(result.alreadySaved ? "Already in the cardholder" : "Saved to the cardholder");
          } catch (err) {
            toast(err instanceof Error ? err.message : "Could not save", "err");
          }
        }}>Save to cardholder</Button> : null}
        <Button variant={token ? "ghost" : "primary"} onClick={() => {
          const blob = new Blob([vcard], { type: "text/vcard" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${card.name}.vcf`;
          link.click();
        }}>Download vCard</Button>
        </div>
        {saved ? <p className="mt-3 text-sm text-[#1287c4]">{saved}</p> : null}
      </div>
    </div>
  );
}
