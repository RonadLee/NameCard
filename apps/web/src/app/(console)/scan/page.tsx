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
  const qrVideo = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [cardLink, setCardLink] = useState("");

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

  async function saveLink(raw: string) {
    const match = raw.match(/\/c\/([A-Za-z0-9_-]+)/) ?? (/^[A-Za-z0-9_-]{4,}$/.test(raw.trim()) ? [raw.trim(), raw.trim()] : null);
    if (!match) {
      toast("Paste a NameCard link such as /c/alexchen", "err");
      return;
    }
    const result = await api<{ name: string; alreadySaved: boolean }>("/contacts/from-card", { method: "POST", body: JSON.stringify({ slug: match[1] }) });
    await queryClient.invalidateQueries({ queryKey: ["contacts"] });
    toast(result.alreadySaved ? `${result.name} is already in the cardholder` : `${result.name} saved to the cardholder`);
  }

  useEffect(() => {
    if (!qrOpen) return;
    let stream: MediaStream | undefined;
    let timer = 0;
    let stopped = false;
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then((media) => {
      stream = media;
      if (qrVideo.current) qrVideo.current.srcObject = media;
      const Detector = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<{ rawValue?: string }[]> } }).BarcodeDetector;
      if (!Detector) return;
      const detector = new Detector({ formats: ["qr_code"] });
      timer = window.setInterval(() => {
        if (stopped || !qrVideo.current || qrVideo.current.readyState < 2) return;
        void detector.detect(qrVideo.current).then((codes) => {
          const value = codes[0]?.rawValue;
          if (!value || stopped) return;
          stopped = true;
          window.clearInterval(timer);
          setQrOpen(false);
          void saveLink(value).catch((error) => toast(error instanceof Error ? error.message : "Could not save the card", "err"));
        }).catch(() => undefined);
      }, 500);
    }).catch(() => toast("Camera permission is required to scan a QR code. Paste the card link instead.", "err"));
    return () => {
      stopped = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [qrOpen, queryClient, toast]);

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
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="grid cursor-pointer place-items-center gap-2 rounded-2xl bg-white p-6 shadow-card">
          <Upload /> Upload image or batch
          <input className="hidden" type="file" accept="image/*,.pdf" multiple onChange={(event) => event.target.files && ingest.mutate(Array.from(event.target.files))} />
        </label>
        <button className="grid place-items-center gap-2 rounded-2xl bg-white p-6 shadow-card" onClick={() => setCamera(true)}><Camera /> Camera capture</button>
        <button className="grid place-items-center gap-2 rounded-2xl bg-white p-6 shadow-card" onClick={() => setQrOpen(true)}>Scan a shared QR</button>
        <label className="grid cursor-pointer place-items-center gap-2 rounded-2xl bg-white p-6 shadow-card">
          PDF upload
          <input className="hidden" type="file" accept="application/pdf" multiple onChange={(event) => event.target.files && ingest.mutate(Array.from(event.target.files))} />
        </label>
      </div>
      {qrOpen ? (
        <div className="mb-6 rounded-2xl bg-white p-4 shadow-card">
          <video ref={qrVideo} autoPlay playsInline muted className="max-h-[320px] w-full rounded-xl bg-black" />
          <p className="mt-3 text-sm text-[#66707c]">Point the camera at a NameCard QR code, or paste the link.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input className={`${controlClass} max-w-md`} placeholder="https://…/c/alexchen" value={cardLink} onChange={(event) => setCardLink(event.target.value)} />
            <Button onClick={() => saveLink(cardLink).then(() => { setCardLink(""); setQrOpen(false); }).catch((error) => toast(error instanceof Error ? error.message : "Could not save the card", "err"))}>Save link</Button>
            <Button variant="ghost" onClick={() => setQrOpen(false)}>Cancel</Button>
          </div>
        </div>
      ) : null}
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
