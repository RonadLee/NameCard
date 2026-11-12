"use client";

import { CardFace } from "@/components/card-face";
import { Button } from "@/components/ui";
import type { Card } from "@/lib/types";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function PublicCardPage() {
  const params = useParams<{ slug: string }>();
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState("");
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
        <Button className="mt-5" onClick={() => {
          const blob = new Blob([vcard], { type: "text/vcard" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${card.name}.vcf`;
          link.click();
        }}>Save contact</Button>
      </div>
    </div>
  );
}
