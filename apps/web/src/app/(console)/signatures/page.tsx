"use client";

import { signatureHtml } from "@/lib/signature";
import { api } from "@/lib/api";
import { useSession } from "@/lib/store";
import type { Card, Signature } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { PageTitle } from "@/components/ui";

export default function SignaturesPage() {
  const userId = useSession((state) => state.user?.id);
  const signatures = useQuery({ queryKey: ["signatures"], queryFn: () => api<Signature[]>("/signatures") });
  const cards = useQuery({ queryKey: ["cards", false], queryFn: () => api<Card[]>("/cards") });
  const sample = cards.data?.find((card) => card.ownerId === userId) ?? cards.data?.[0];
  if (!signatures.data) return <p className="text-sm text-[#8b919a]">Loading signatures…</p>;
  if (!signatures.data.length) {
    return (
      <div>
        <PageTitle title="Email Signature" action={<Link href="/signatures/new" className="grid h-7 w-7 place-items-center rounded-full border border-[#e6e8ee] bg-white" aria-label="Create signature"><Plus size={16} /></Link>} extra={<Link href="/signatures/new" className="inline-flex h-9 items-center rounded-full bg-[#1aa3e8] px-4 text-sm font-medium text-white"><Plus size={16} /> Create signature</Link>} />
        <div className="grid min-h-[60vh] place-items-center text-center">
          <div>
            {sample ? <div className="mx-auto mb-8 max-w-md rounded-2xl bg-white p-4 text-left shadow-card" dangerouslySetInnerHTML={{ __html: signatureHtml({ template: "classic", theme: sample.themeColor, showQr: true, showPhoto: true, showSocial: true }, sample) }} /> : null}
            <h2 className="text-xl font-semibold">Email Signatures</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#8b919a]">Transform your email communications into engaging, professional interactions.</p>
            <Link href="/signatures/new" className="mt-5 inline-flex h-10 items-center rounded-full bg-[#1aa3e8] px-5 text-sm font-medium text-white"><Plus size={16} /> Create signature</Link>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div>
      <PageTitle title="Email Signature" action={<Link href="/signatures/new" className="grid h-7 w-7 place-items-center rounded-full border border-[#e6e8ee] bg-white" aria-label="Create signature"><Plus size={16} /></Link>} />
      <div className="grid gap-4 lg:grid-cols-2">
        {signatures.data.map((signature) => (
          <Link key={signature.id} href={`/signatures/${signature.id}`} className="rounded-2xl bg-white p-4 shadow-card">
            <div className="mb-3 text-sm font-medium">{signature.name}</div>
            <div dangerouslySetInnerHTML={{ __html: signatureHtml(signature, signature.card) }} />
          </Link>
        ))}
      </div>
    </div>
  );
}
