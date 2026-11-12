"use client";

import { Button, controlClass, Field, PageTitle } from "@/components/ui";
import { api } from "@/lib/api";
import { useSession } from "@/lib/store";
import type { ScanItem } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const languages = [
  ["eng", "English"],
  ["chi_sim", "Simplified Chinese"],
  ["chi_tra", "Traditional Chinese"],
  ["jpn", "Japanese"],
  ["kor", "Korean"],
  ["eng+chi_sim", "English + Simplified Chinese"],
];

const fieldKeys = ["name", "nameZh", "nameEn", "company", "jobTitle", "email", "mobile", "phone", "website", "address"] as const;

export default function ScanPage() {
  const toast = useSession((state) => state.toast);
  const queryClient = useQueryClient();
  const scans = useQuery({ queryKey: ["scans"], queryFn: () => api<ScanItem[]>("/scans") });
  const [language, setLanguage] = useState("eng");
  const [active, setActive] = useState<ScanItem | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState(false);

  const ingest = useMutation({
    mutationFn: async (files: File[]) => {
      const body = new FormData();
      files.forEach((file) => body.append("files", file));
      body.append("language", language);
      return api<{ items: ScanItem[] }>("/scans", { method: "POST", body });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["scans"] });
      setActive(result.items[0] ?? null);
      toast(`${result.items.length} scan${result.items.length === 1 ? "" : "s"} ready to review`);
    },
    onError: (error) => toast(error instanceof Error ? error.message : "Scan failed", "err"),
  });

  useEffect(() => {
    if (!camera) return;
    let stream: MediaStream;
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then((media) => {
      stream = media;
      if (video.current) video.current.srcObject = media;
    }).catch(() => toast("Camera permission is required to capture a card", "err"));
    return () => stream?.getTracks().forEach((track) => track.stop());
  }, [camera, toast]);

  async function capture() {
    const node = video.current;
    if (!node) return;
    const canvas = document.createElement("canvas");
    canvas.width = node.videoWidth || 1280;
    canvas.height = node.videoHeight || 720;
    canvas.getContext("2d")?.drawImage(node, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) return;
    setCamera(false);
    ingest.mutate([new File([blob], "camera.jpg", { type: "image/jpeg" })]);
  }

  return (
    <div>
      <PageTitle title="Scan Cards" extra={<select className={`${controlClass} w-64`} value={language} onChange={(event) => setLanguage(event.target.value)}>{languages.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>} />
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <label className="grid cursor-pointer place-items-center gap-2 rounded-2xl bg-white p-6 shadow-card">
          <Upload /> Upload image or batch
          <input className="hidden" type="file" accept="image/*,.pdf" multiple onChange={(event) => event.target.files && ingest.mutate(Array.from(event.target.files))} />
        </label>
        <button className="grid place-items-center gap-2 rounded-2xl bg-white p-6 shadow-card" onClick={() => setCamera(true)}><Camera /> Camera capture</button>
        <label className="grid cursor-pointer place-items-center gap-2 rounded-2xl bg-white p-6 shadow-card">
          PDF upload
          <input className="hidden" type="file" accept="application/pdf" multiple onChange={(event) => event.target.files && ingest.mutate(Array.from(event.target.files))} />
        </label>
      </div>
      {camera ? (
        <div className="mb-6 rounded-2xl bg-black p-3">
          <video ref={video} autoPlay playsInline className="max-h-[420px] w-full rounded-xl" />
          <div className="mt-3 flex gap-2"><Button onClick={capture}>Capture</Button><Button variant="ghost" onClick={() => setCamera(false)}>Cancel</Button></div>
        </div>
      ) : null}
      {ingest.isPending ? <p className="mb-4 text-sm text-[#8b919a]">Reading the card…</p> : null}
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          {(scans.data ?? []).map((scan) => (
            <button key={scan.id} onClick={() => setActive(scan)} className={`w-full rounded-xl bg-white p-3 text-left text-sm shadow-card ${active?.id === scan.id ? "ring-2 ring-[#1aa3e8]" : ""}`}>
              <div className="font-medium">{scan.fields.name || scan.fileName || "Untitled scan"}</div>
              <div className="text-xs text-[#8b919a]">{scan.status} · {scan.engine} · {Math.round(scan.confidence * 100)}%</div>
            </button>
          ))}
        </div>
        {active ? <Review scan={active} onChange={setActive} /> : <div className="grid place-items-center rounded-2xl bg-white text-sm text-[#b0b6be] shadow-card">Upload a card to review the extracted fields.</div>}
      </div>
    </div>
  );
}

function Review({ scan, onChange }: { scan: ScanItem; onChange: (scan: ScanItem) => void }) {
  const toast = useSession((state) => state.toast);
  const queryClient = useQueryClient();
  const [fields, setFields] = useState(scan.fields);
  useEffect(() => setFields(scan.fields), [scan]);
  const save = useMutation({
    mutationFn: async () => {
      await api(`/scans/${scan.id}`, { method: "PATCH", body: JSON.stringify(fields) });
      return api(`/scans/${scan.id}/save`, { method: "POST" });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["scans"] });
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast("Saved to the cardholder");
    },
    onError: (error) => toast(error instanceof Error ? error.message : "Could not save", "err"),
  });
  return (
    <div className="grid gap-4 rounded-2xl bg-white p-4 shadow-card md:grid-cols-2">
      <div>
        {scan.imageUrl && !scan.imageUrl.endsWith(".pdf") ? <img src={scan.imageUrl} alt="Scanned card" className="w-full rounded-xl bg-[#f4f6f9]" /> : <div className="rounded-xl bg-[#f4f6f9] p-6 text-sm">PDF stored. Review the extracted text below.</div>}
        <p className="mt-3 text-xs text-[#66707c]">{scan.note}</p>
        <p className="mt-1 text-xs text-[#98a1ab]">Sharpness {scan.sharpness?.toFixed(1) ?? "n/a"} · rotation {scan.rotation}° · engine {scan.engine}</p>
        {scan.duplicateOf ? <p className="mt-2 rounded-xl bg-[#fff7e8] p-2 text-xs text-[#8a5a00]">Possible duplicate of an existing contact.</p> : null}
        <Button className="mt-3" variant="ghost" onClick={async () => onChange(await api<ScanItem>(`/scans/${scan.id}/rotate`, { method: "POST" }))}>Rotate 90°</Button>
      </div>
      <div className="space-y-3">
        {fieldKeys.map((key) => (
          <Field key={key} label={`${key} · ${Math.round((fields.confidence?.[key] ?? 0) * 100)}%`}>
            <input className={controlClass} value={fields[key] || ""} onChange={(event) => setFields({ ...fields, [key]: event.target.value })} />
          </Field>
        ))}
        <Button onClick={() => save.mutate()} disabled={save.isPending || scan.status === "SAVED"}>{scan.status === "SAVED" ? "Saved" : "Save to cardholder"}</Button>
      </div>
    </div>
  );
}
