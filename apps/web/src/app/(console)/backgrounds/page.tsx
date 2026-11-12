"use client";

import { PageTitle } from "@/components/ui";
import { api } from "@/lib/api";
import { formatWhen } from "@/lib/utils";
import type { VirtualBackground } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";

export default function BackgroundsPage() {
  const rows = useQuery({ queryKey: ["backgrounds"], queryFn: () => api<VirtualBackground[]>("/backgrounds") });
  return (
    <div>
      <PageTitle
        title="Virtual Background"
        extra={
          <div className="flex items-center gap-4">
            <a className="text-sm text-[#1aa3e8]" href="https://www.camcard.com/virtual-background" target="_blank" rel="noreferrer">How do I use my virtual background?</a>
            <Link href="/backgrounds/new" className="inline-flex h-9 items-center gap-1 rounded-full bg-[#1aa3e8] px-4 text-sm font-medium text-white"><Plus size={15} /> Create New Background</Link>
          </div>
        }
      />
      <div className="overflow-hidden rounded-2xl bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="text-[#98a1ab]">
            <tr className="border-b border-[#f0f2f5]">
              <th className="px-5 py-4 font-medium">Background image</th>
              <th className="px-5 py-4 font-medium">Name</th>
              <th className="px-5 py-4 font-medium">Job title</th>
              <th className="px-5 py-4 font-medium">Create time</th>
              <th className="px-5 py-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(rows.data ?? []).map((row) => (
              <tr key={row.id} className="border-b border-[#f6f7f9]">
                <td className="px-5 py-3">{row.backgroundUrl ? <img src={row.backgroundUrl} alt="" className="h-12 w-20 rounded-lg object-cover" /> : <div className="h-12 w-20 rounded-lg" style={{ background: row.accent }} />}</td>
                <td className="px-5 py-3">{row.name}</td>
                <td className="px-5 py-3">{row.jobTitle}</td>
                <td className="px-5 py-3">{formatWhen(row.createdAt)}</td>
                <td className="px-5 py-3"><Link className="text-[#1aa3e8]" href={`/backgrounds/${row.id}`}>Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.data?.length ? <div className="grid h-80 place-items-center text-sm text-[#b0b6be]">No Data</div> : null}
      </div>
    </div>
  );
}
