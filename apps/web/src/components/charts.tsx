"use client";

export function LineChart({ series, metric }: { series: { date: string; view: number; share: number; scan: number }[]; metric: "view" | "share" | "scan" }) {
  const values = series.map((row) => row[metric]);
  const max = Math.max(1, ...values);
  const width = 640;
  const height = 180;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values.map((value, index) => `${index * step},${height - (value / max) * (height - 16) - 8}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full">
      <polyline fill="none" stroke="#1aa3e8" strokeWidth="3" points={points} />
    </svg>
  );
}

export function BarChart({ cards }: { cards: { name: string; events: number }[] }) {
  const rows = cards.slice(0, 6);
  const max = Math.max(1, ...rows.map((row) => row.events));
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.name} className="grid grid-cols-[120px_1fr_32px] items-center gap-2 text-sm">
          <span className="truncate text-[#5c6570]">{row.name}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-[#eef2f6]">
            <div className="h-full rounded-full bg-[#1aa3e8]" style={{ width: `${(row.events / max) * 100}%` }} />
          </div>
          <span className="text-right text-[#8b919a]">{row.events}</span>
        </div>
      ))}
    </div>
  );
}

export function PieChart({ totals }: { totals: Record<string, number> }) {
  const parts = [
    ["Views", totals.view || 0, "#1aa3e8"],
    ["Shares", totals.share || 0, "#6cc4ef"],
    ["Scans", totals.scan || 0, "#f05a4a"],
    ["Saves", totals.save || 0, "#f5b942"],
    ["Downloads", totals.download || 0, "#7d8b99"],
  ] as const;
  const sum = parts.reduce((total, part) => total + part[1], 0) || 1;
  let cursor = 0;
  const slices = parts.map((part) => {
    const start = cursor;
    cursor += (part[1] / sum) * 360;
    return `${part[2]} ${start}deg ${cursor}deg`;
  });
  return (
    <div className="flex items-center gap-6">
      <div className="h-36 w-36 rounded-full" style={{ background: `conic-gradient(${slices.join(",")})` }} />
      <ul className="space-y-1 text-sm">
        {parts.map((part) => (
          <li key={part[0]} className="flex items-center gap-2 text-[#5c6570]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: part[2] }} />
            {part[0]} · {part[1]}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Heatmap({ cells }: { cells: number[][] }) {
  const max = Math.max(1, ...cells.flat());
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <div className="space-y-1">
      {cells.map((row, day) => (
        <div key={days[day]} className="grid grid-cols-[36px_repeat(12,minmax(0,1fr))] items-center gap-1">
          <span className="text-[11px] text-[#8b919a]">{days[day]}</span>
          {row.map((value, hour) => (
            <div key={hour} title={`${days[day]} ${hour * 2}:00 · ${value}`} className="h-4 rounded-sm" style={{ background: `rgba(26,163,232,${0.12 + (value / max) * 0.88})` }} />
          ))}
        </div>
      ))}
    </div>
  );
}
