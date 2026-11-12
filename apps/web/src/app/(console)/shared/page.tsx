"use client";

import { CardFace } from "@/components/card-face";
import { PageTitle } from "@/components/ui";
import { api } from "@/lib/api";
import type { Card } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";

export default function SharedPage() {
  const cards = useQuery({ queryKey: ["shared"], queryFn: () => api<Card[]>("/cards/shared") });
  return (
    <div>
      <PageTitle title="Shared Cards" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(cards.data ?? []).map((card) => (
          <article key={card.id} className="rounded-2xl bg-white p-4 shadow-card">
            <CardFace card={card} />
            <div className="mt-3 flex items-center justify-between text-sm text-[#66707c]">
              <span>{card.owner?.name}</span>
              <span className="rounded-full bg-[#eef8fd] px-2 py-1 text-xs text-[#1287c4]">{card.visibility}</span>
            </div>
          </article>
        ))}
      </div>
      {!cards.data?.length ? <p className="text-sm text-[#b0b6be]">No team or public cards yet.</p> : null}
    </div>
  );
}
