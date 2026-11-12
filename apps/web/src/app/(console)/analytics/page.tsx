"use client";

import { BarChart, Heatmap, LineChart, PieChart } from "@/components/charts";
import { Button, PageTitle } from "@/components/ui";
import { api, download } from "@/lib/api";
import type { AnalyticsReport } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

export default function AnalyticsPage() {
  const [metric, setMetric] = useState<"view" | "share" | "scan">("view");
  const report = useQuery({ queryKey: ["analytics"], queryFn: () => api<AnalyticsReport>("/analytics?days=30") });
  if (!report.data) return <p className="text-sm text-[#8b919a]">Loading analytics…</p>;
  const totals = [
    ["Card views", report.data.totals.view],
    ["Shares", report.data.totals.share],
    ["QR scans", report.data.totals.scan],
    ["Downloads", report.data.totals.download],
    ["Contact saves", report.data.totals.save],
    ["Team activity", report.data.totals.activity],
  ];
  return (
    <div>
      <PageTitle title="Analytics" extra={<div className="flex gap-2"><Button variant="ghost" onClick={() => download("/analytics/export/xlsx", "analytics.xlsx")}>XLSX</Button><Button variant="ghost" onClick={() => download("/analytics/export/pdf", "analytics.pdf")}>PDF</Button></div>} />
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {totals.map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl bg-white p-4 shadow-card">
            <div className="text-xs text-[#8b919a]">{label}</div>
            <div className="mt-2 text-2xl font-semibold">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl bg-white p-4 shadow-card">
          <div className="mb-2 flex gap-2 text-sm">{(["view", "share", "scan"] as const).map((item) => <button key={item} className={metric === item ? "text-[#1aa3e8]" : "text-[#8b919a]"} onClick={() => setMetric(item)}>{item}</button>)}</div>
          <LineChart series={report.data.series} metric={metric} />
        </section>
        <section className="rounded-2xl bg-white p-4 shadow-card">
          <h2 className="mb-3 font-medium">Cards</h2>
          <BarChart cards={report.data.cards} />
        </section>
        <section className="rounded-2xl bg-white p-4 shadow-card">
          <h2 className="mb-3 font-medium">Mix</h2>
          <PieChart totals={report.data.totals} />
        </section>
        <section className="rounded-2xl bg-white p-4 shadow-card">
          <h2 className="mb-3 font-medium">Activity heatmap</h2>
          <Heatmap cells={report.data.heatmap} />
        </section>
      </div>
    </div>
  );
}
