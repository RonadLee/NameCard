"use client";

import { cn } from "@/lib/utils";
import { useSession } from "@/lib/store";
import { BarChart3, Crown, IdCard, Image as ImageIcon, Mail, Menu, Network, PanelLeft, ScanLine, Settings, Share2, Users, Wallet, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const primary = [
  { href: "/cards", label: "My Cards", icon: IdCard },
  { href: "/signatures", label: "Email Signature", icon: Mail },
  { href: "/backgrounds", label: "Virtual Background", icon: ImageIcon },
  { href: "/cardholder", label: "Cardholder", icon: Wallet },
];

const enterprise = [
  { href: "/scan", label: "Scan Cards", icon: ScanLine },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/teams", label: "Teams", icon: Network },
  { href: "/shared", label: "Shared Cards", icon: Share2 },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const mobile = [
  { href: "/cards", label: "Cards", icon: IdCard },
  { href: "/scan", label: "Scan", icon: ScanLine },
  { href: "/cardholder", label: "Holder", icon: Wallet },
  { href: "/contacts", label: "Contacts", icon: Users },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const collapsed = useSession((state) => state.collapsed);
  const setCollapsed = useSession((state) => state.setCollapsed);
  const workspace = useSession((state) => state.workspace);
  const user = useSession((state) => state.user);
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f6f9] text-[#1c1f23]">
      <motion.aside
        className="hidden h-screen shrink-0 flex-col border-r border-[#eceef2] bg-white md:flex"
        animate={{ width: collapsed ? 76 : 240 }}
        transition={{ type: "spring", stiffness: 280, damping: 32 }}
      >
        <SidebarBody collapsed={collapsed} pathname={pathname} onToggle={() => setCollapsed(!collapsed)} workspace={workspace?.name ?? "Workspace"} plan={workspace?.plan ?? "PERSONAL"} user={user?.name ?? ""} />
      </motion.aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-[#eceef2] bg-white px-4 py-3 md:hidden">
          <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-full p-1"><Menu size={20} /></button>
          <Logo />
          <span className="text-sm font-bold tracking-wide text-[#1aa3e8]">NAMECARD</span>
        </div>
        {offline ? <div className="bg-[#fff7e8] px-4 py-2 text-center text-sm text-[#8a5a00]">You are offline. Saved cards and contacts are still available from this device.</div> : null}
        <main className="flex-1 overflow-y-auto px-4 py-5 pb-24 md:px-8 md:py-6 md:pb-8">
          <motion.div key={pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
            {children}
          </motion.div>
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[#eceef2] bg-white md:hidden">
          {mobile.map((item) => (
            <Link key={item.href} href={item.href} className={cn("flex flex-col items-center gap-1 py-2 text-[11px]", pathname.startsWith(item.href) ? "text-[#1aa3e8]" : "text-[#8b919a]")}>
              <item.icon size={18} />
              {item.label}
            </Link>
          ))}
          <button className="flex flex-col items-center gap-1 py-2 text-[11px] text-[#8b919a]" onClick={() => setMore(true)}>
            <Menu size={18} />
            More
          </button>
        </nav>
      </div>
      <AnimatePresence>
        {open ? (
          <motion.div className="fixed inset-0 z-40 bg-[#1c1f23]/40 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.aside className="h-full w-[260px] bg-white" initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} onClick={(event) => event.stopPropagation()}>
              <SidebarBody collapsed={false} pathname={pathname} onToggle={() => setOpen(false)} workspace={workspace?.name ?? "Workspace"} plan={workspace?.plan ?? "PERSONAL"} user={user?.name ?? ""} />
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {more ? (
          <motion.div className="fixed inset-0 z-40 bg-[#1c1f23]/40 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMore(false)}>
            <motion.div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-4" initial={{ y: 320 }} animate={{ y: 0 }} exit={{ y: 320 }} onClick={(event) => event.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between"><span className="font-semibold">More</span><button onClick={() => setMore(false)} aria-label="Close"><X size={18} /></button></div>
              {enterprise.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setMore(false)} className="flex items-center gap-3 rounded-xl px-2 py-3 text-sm hover:bg-[#f4f6f9]">
                  <item.icon size={18} /> {item.label}
                </Link>
              ))}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SidebarBody({ collapsed, pathname, onToggle, workspace, plan, user }: { collapsed: boolean; pathname: string; onToggle: () => void; workspace: string; plan: string; user: string }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 pb-2 pt-4">
        <Logo />
        {!collapsed ? <span className="text-[15px] font-bold tracking-[0.04em] text-[#1aa3e8]">NAMECARD</span> : null}
        <button className="ml-auto rounded-md p-1 text-[#98a1ab] hover:bg-[#f4f6f9]" onClick={onToggle} aria-label="Collapse sidebar"><PanelLeft size={16} /></button>
      </div>
      <div className={cn("mx-3 mt-2 flex items-center gap-2 rounded-xl bg-[#f6f7f9] px-2 py-2", collapsed && "justify-center px-0")}>
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#d9eef8] text-xs font-semibold text-[#1aa3e8]">{user.slice(0, 1) || "N"}</div>
        {!collapsed ? (
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{workspace}</div>
            <div className="text-[11px] text-[#8b919a]">{plan === "TEAM" ? "Team" : "Personal"}</div>
          </div>
        ) : null}
      </div>
      <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-2">
        {[...primary, ...enterprise].map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href} className={cn("relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#3d4550]", active && "bg-[#f3f5f7] font-medium text-[#1c1f23]", collapsed && "justify-center px-0")}>
              {active ? <span className="absolute left-0 top-2 h-5 w-[3px] rounded-full bg-[#1aa3e8]" /> : null}
              <item.icon size={18} className={active ? "text-[#1c1f23]" : "text-[#8b919a]"} />
              {!collapsed ? item.label : null}
            </Link>
          );
        })}
      </nav>
      <div className="p-3">
        {plan === "TEAM" ? (
          <div className={cn("rounded-2xl border border-[#eceef2] p-3 text-sm", collapsed && "px-2 text-center")}>
            <Crown size={16} className="text-[#1aa3e8]" />
            {!collapsed ? <div className="mt-2 font-medium">Team plan</div> : null}
            {!collapsed ? <p className="mt-1 text-xs leading-5 text-[#8b919a]">Shared templates, departments, and company cardholder are on.</p> : null}
          </div>
        ) : (
          <div className={cn("rounded-2xl border border-[#eceef2] p-3", collapsed && "px-2")}>
            <div className="grid h-7 w-7 place-items-center rounded-full border border-[#eceef2] text-[#8b919a]"><Crown size={14} /></div>
            {!collapsed ? (
              <>
                <div className="mt-3 text-sm font-semibold">Upgrade to Team</div>
                <p className="mt-1 text-xs leading-5 text-[#8b919a]">Upgrading to Team Edition allows multiple people to use the same template.</p>
                <Link href="/settings?tab=billing" className="mt-3 flex h-8 items-center justify-center rounded-full bg-[#f2f3f5] text-xs font-medium text-[#3d4550]">Upgrade</Link>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function Logo() {
  return (
    <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#1aa3e8] text-[11px] font-bold text-white">NC</span>
  );
}
