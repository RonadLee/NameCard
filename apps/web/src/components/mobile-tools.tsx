"use client";

import { download } from "@/lib/api";
import { useSession } from "@/lib/store";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

const links = [
  { href: "/signatures", label: "Email Signature" },
  { href: "/backgrounds", label: "Virtual Background" },
];

export function MobileTools() {
  const toast = useSession((state) => state.toast);
  async function excel() {
    try {
      await download("/contacts/export?format=xlsx&scope=mine", "contacts.xlsx");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not export", "err");
    }
  }
  return (
    <div className="px-4 pb-6 pt-4">
      <h1 className="text-[28px] font-semibold">Tools</h1>
      <div className="mt-4 overflow-hidden rounded-2xl bg-white">
        {links.map((item) => (
          <Link key={item.href} href={item.href} className="flex items-center border-b border-[#f4f6f9] px-4 py-4 text-sm last:border-b-0">
            <span className="flex-1">{item.label}</span>
            <ChevronRight size={16} className="text-[#c5ccd4]" />
          </Link>
        ))}
        <button type="button" className="flex w-full items-center px-4 py-4 text-left text-sm" onClick={() => void excel()}>
          <span className="flex-1">Export to Excel</span>
          <ChevronRight size={16} className="text-[#c5ccd4]" />
        </button>
      </div>
    </div>
  );
}
