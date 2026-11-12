"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect } from "react";

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "soft" }) {
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium transition active:scale-[0.98] disabled:opacity-50",
        variant === "primary" && "bg-[#1aa3e8] text-white shadow-sm hover:bg-[#1296d8]",
        variant === "ghost" && "border border-[#e4e7ec] bg-white text-[#3c434c] hover:bg-[#f7f8fa]",
        variant === "soft" && "bg-[#eef8fd] text-[#1287c4] hover:bg-[#e3f3fb]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-[13px] text-[#66707c]">{label}</span>
      {children}
    </label>
  );
}

export const controlClass =
  "h-10 w-full rounded-xl border border-[#e6e8ee] bg-white px-3 text-sm outline-none transition focus:border-[#1aa3e8] focus:ring-2 focus:ring-[#1aa3e8]/20";

export function Dialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1c1f23]/40 p-4 sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-card" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="rounded-full p-1 text-[#8b919a] hover:bg-[#f4f6f9]" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageTitle({ title, action, extra }: { title: string; action?: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
        {action}
      </div>
      {extra}
    </div>
  );
}
