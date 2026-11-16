"use client";

import { cn } from "@/lib/utils";
import { Camera, Folder, Home, Settings, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/cards", label: "Home", icon: Home, testId: "mobile-tab-home" },
  { href: "/cardholder", label: "CardHolder", icon: Wallet, testId: "mobile-tab-holder" },
  { href: "/tools", label: "Tools", icon: Folder, testId: "mobile-tab-tools" },
  { href: "/settings", label: "Settings", icon: Settings, testId: "mobile-tab-settings" },
];

export function MobileFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pushed = pathname.startsWith("/scan") || /^\/cardholder\/.+/.test(pathname);
  return (
    <div data-testid="mobile-shell" className="flex h-[100dvh] w-full max-w-full flex-col overflow-hidden bg-[#f3f5f8] text-[#1c1f23]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden", pushed ? "overflow-hidden" : "overflow-y-auto")}>
        {children}
      </div>
      {pushed ? null : (
        <nav className="relative grid shrink-0 grid-cols-5 border-t border-[#e6e9ef] bg-white" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {tabs.slice(0, 2).map((item) => <Tab key={item.href} item={item} pathname={pathname} />)}
          <div className="relative">
            <Link href="/scan" data-testid="mobile-tab-scan" aria-label="Scan" className="absolute left-1/2 top-0 grid h-14 w-14 -translate-x-1/2 -translate-y-5 place-items-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#c7b0ff,#6d4aff)] text-white shadow-[0_8px_18px_rgba(109,74,255,0.35)]">
              <Camera size={24} />
            </Link>
          </div>
          {tabs.slice(2).map((item) => <Tab key={item.href} item={item} pathname={pathname} />)}
        </nav>
      )}
    </div>
  );
}

function Tab({ item, pathname }: { item: (typeof tabs)[number]; pathname: string }) {
  const active = item.href === "/cards"
    ? pathname === "/cards" || pathname.startsWith("/cards/")
    : item.href === "/cardholder"
      ? pathname === "/cardholder"
      : item.href === "/tools"
        ? pathname === "/tools" || pathname.startsWith("/signatures") || pathname.startsWith("/backgrounds")
        : pathname.startsWith(item.href);
  const Icon = item.icon;
  return (
    <Link href={item.href} data-testid={item.testId} className={cn("flex flex-col items-center gap-1 py-2 text-[11px]", active ? "text-[#1c1f23]" : "text-[#98a1ab]")}>
      <Icon size={20} />
      {item.label}
    </Link>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[#1c1f23]/40" onClick={onClose}>
      <div className="max-h-[80dvh] w-full overflow-y-auto rounded-t-3xl bg-white px-4 pt-4" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }} onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-[#f3f5f8] text-sm" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
