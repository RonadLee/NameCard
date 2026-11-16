"use client";

import { api } from "@/lib/api";
import { useSession } from "@/lib/store";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useHydratedSession } from "../providers";

const links = [
  { href: "/cards", label: "My Cards" },
  { href: "/cardholder", label: "Cardholder" },
  { href: "/signatures", label: "Email Signature" },
  { href: "/backgrounds", label: "Virtual Background" },
];

export default function HolderLayout({ children }: { children: React.ReactNode }) {
  const ready = useHydratedSession();
  const token = useSession((state) => state.accessToken);
  const logout = useSession((state) => state.logout);
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (ready && !token) router.replace("/login");
  }, [ready, token, router]);

  async function signOut() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    logout();
    window.location.href = "/login";
  }

  if (!ready || !token) return <div className="grid h-screen place-items-center text-sm text-[#8b919a]">Loading workspace…</div>;
  return (
    <div className="flex h-screen flex-col bg-[#eef1f4]">
      <header className="flex h-12 shrink-0 items-center gap-4 bg-[#1787c4] px-4 text-sm text-white">
        <Link href="/cards" className="font-bold tracking-wide">NAMECARD</Link>
        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {links.map((item) => {
            const active = item.href === "/cardholder" ? pathname.startsWith("/cardholder") : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={cn("shrink-0 rounded px-3 py-1.5", active && "bg-white/15 font-semibold")}>{item.label}</Link>
            );
          })}
        </nav>
        <button className="ml-auto inline-flex shrink-0 items-center gap-1.5" onClick={() => void signOut()}><LogOut size={15} /> Sign out</button>
      </header>
      <Suspense fallback={<div className="grid flex-1 place-items-center text-sm text-[#8b919a]">Loading cardholder…</div>}>
        <div className="min-h-0 flex-1">{children}</div>
      </Suspense>
    </div>
  );
}
