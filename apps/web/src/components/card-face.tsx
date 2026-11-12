"use client";

import type { Card } from "@/lib/types";

export function CardFace({ card, compact = false }: { card: Partial<Card>; compact?: boolean }) {
  const font = card.font === "Georgia" ? "Georgia, serif" : card.font === "Trebuchet MS" ? '"Trebuchet MS", sans-serif' : "Inter, sans-serif";
  const color = card.themeColor || "#1aa3e8";
  if (card.template === "banner") {
    return (
      <div className="overflow-hidden rounded-xl bg-white shadow-inner" style={{ fontFamily: font }}>
        <div className="h-16 bg-cover bg-center" style={{ background: card.bannerUrl ? `url(${card.bannerUrl}) center/cover` : color }} />
        <div className="flex gap-3 px-4 pb-4">
          <Avatar card={card} className="-mt-6 h-12 w-12 border-2 border-white" />
          <div className="min-w-0 pt-1">
            <div className="truncate text-[15px] font-semibold">{card.name || "Your name"}</div>
            <div className="truncate text-xs text-[#66707c]">{card.jobTitle}</div>
            <div className="truncate text-xs text-[#8b919a]">{card.company}</div>
          </div>
        </div>
      </div>
    );
  }
  if (card.template === "split") {
    return (
      <div className="flex h-[148px] overflow-hidden rounded-xl bg-white" style={{ fontFamily: font }}>
        <div className="w-3" style={{ background: color }} />
        <div className="flex flex-1 items-center justify-between gap-3 px-4">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-[#8b919a]">{card.company || "Company"}</div>
            <div className="truncate text-[16px] font-semibold">{card.name || "Your name"}</div>
            <div className="truncate text-xs text-[#5c6570]">{card.jobTitle}</div>
            <div className="mt-2 truncate text-[11px] text-[#6b7280]">{card.email}</div>
          </div>
          <Mark card={card} />
        </div>
      </div>
    );
  }
  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl bg-[#e7ebf0] ${compact ? "h-[120px] p-3" : "h-[148px] p-4"}`} style={{ fontFamily: font }}>
      <div className="min-w-0">
        <div className="text-[11px] text-[#8b919a]">{card.company || "Company"}</div>
        <div className="truncate text-[15px] font-semibold text-[#1c1f23]">{card.name || "Your name"}</div>
        {card.nameZh ? <div className="truncate text-xs text-[#5c6570]">{card.nameZh}</div> : null}
        <div className="truncate text-xs text-[#5c6570]">{card.jobTitle}</div>
        <div className="mt-3 truncate text-[11px] text-[#6b7280]">{card.email || card.mobile}</div>
      </div>
      <Mark card={card} />
    </div>
  );
}

function Mark({ card }: { card: Partial<Card> }) {
  if (card.logoUrl) return <img src={card.logoUrl} alt="" className="h-14 w-16 shrink-0 object-contain" />;
  return (
    <svg width="64" height="40" viewBox="0 0 64 40" aria-hidden>
      <circle cx="24" cy="20" r="14" fill={card.themeColor || "#1aa3e8"} />
      <circle cx="42" cy="20" r="14" fill="#f05a4a" />
    </svg>
  );
}

function Avatar({ card, className }: { card: Partial<Card>; className?: string }) {
  if (card.photoUrl) return <img src={card.photoUrl} alt="" className={`rounded-full object-cover ${className}`} />;
  return <div className={`grid place-items-center rounded-full text-sm font-semibold text-white ${className}`} style={{ background: card.themeColor || "#1aa3e8" }}>{(card.name || "?").slice(0, 1)}</div>;
}

export { publicUrl } from "@/lib/signature";
