"use client";

import { CardFace } from "@/components/card-face";
import { Button, PageTitle } from "@/components/ui";
import { api } from "@/lib/api";
import { useSession } from "@/lib/store";
import type { Card } from "@/lib/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function SharedPage() {
  const toast = useSession((state) => state.toast);
  const queryClient = useQueryClient();
  const cards = useQuery({ queryKey: ["shared"], queryFn: () => api<Card[]>("/cards/shared") });
  async function save(card: Card) {
    try {
      const result = await api<{ alreadySaved: boolean }>(`/contacts/from-card`, { method: "POST", body: JSON.stringify({ slug: card.qrSlug }) });
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast(result.alreadySaved ? `${card.name} is already in the cardholder` : `${card.name} saved to the cardholder`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save", "err");
    }
  }
  return (
    <div>
      <PageTitle title="Shared Cards" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(cards.data ?? []).map((card) => (
          <article key={card.id} className="rounded-2xl bg-white p-4 shadow-card">
            <CardFace card={card} />
            <div className="mt-3 flex items-center justify-between text-sm text-[#66707c]">
              <span>{card.owner?.name}</span>
              <span className="flex items-center gap-2"><span className="rounded-full bg-[#eef8fd] px-2 py-1 text-xs text-[#1287c4]">{card.visibility}</span><Button variant="soft" onClick={() => save(card)}>Save</Button></span>
            </div>
          </article>
        ))}
      </div>
      {!cards.data?.length ? <p className="text-sm text-[#b0b6be]">No team or public cards yet.</p> : null}
    </div>
  );
}
