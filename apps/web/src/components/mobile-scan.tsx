"use client";

import { api } from "@/lib/api";
import { useSession } from "@/lib/store";
import type { ScanItem } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const modes = ["Batch", "Multiple", "Single", "QR Code"] as const;
const fields = ["name", "company", "jobTitle", "email", "mobile", "phone", "address"] as const;

export function MobileScan() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useSession((state) => state.toast);
  const queryClient = useQueryClient();
  const video = useRef<HTMLVideoElement>(null);
  const album = useRef<HTMLInputElement>(null);
  const [accuracy, setAccuracy] = useState<"basic" | "high">(params.get("accuracy") === "high" ? "high" : "basic");
  const [mode, setMode] = useState<(typeof modes)[number]>("Single");
  const [active, setActive] = useState<ScanItem | null>(null);
  const [draft, setDraft] = useState<ScanItem["fields"] | null>(null);
  const [saving, setSaving] = useState(false);
  const scans = useQuery({ queryKey: ["scans"], queryFn: () => api<ScanItem[]>("/scans"), staleTime: 15_000 });
  const pending = (scans.data ?? []).filter((scan) => scan.status === "REVIEW").length;
  const language = accuracy === "high" ? "eng+chi_sim" : "eng";

  const ingest = useMutation({
    mutationFn: async (files: File[]) => {
      const body = new FormData();
      files.forEach((file) => body.append("files", file));
      body.append("language", language);
      return api<{ items: ScanItem[] }>("/scans", { method: "POST", body });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["scans"] });
      const item = result.items[0];
      if (!item) return;
      if (mode === "Single") {
        setActive(item);
        setDraft(item.fields);
      } else toast(`${result.items.length} card${result.items.length === 1 ? "" : "s"} being recognized`);
    },
    onError: (error) => toast(error instanceof Error ? error.message : "Scan failed", "err"),
  });

  useEffect(() => {
    if (mode === "Batch") return;
    let stream: MediaStream | undefined;
    let timer = 0;
    let stopped = false;
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then((media) => {
      stream = media;
      if (video.current) video.current.srcObject = media;
      if (mode !== "QR Code") return;
      const Detector = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<{ rawValue?: string }[]> } }).BarcodeDetector;
      if (!Detector) return;
      const detector = new Detector({ formats: ["qr_code"] });
      timer = window.setInterval(() => {
        if (stopped || !video.current || video.current.readyState < 2) return;
        void detector.detect(video.current).then((codes) => {
          const value = codes[0]?.rawValue;
          if (!value || stopped) return;
          stopped = true;
          const match = value.match(/\/c\/([A-Za-z0-9_-]+)/);
          if (!match) return;
          void api<{ name: string; alreadySaved: boolean }>("/contacts/from-card", { method: "POST", body: JSON.stringify({ slug: match[1] }) }).then((saved) => {
            toast(saved.alreadySaved ? `${saved.name} is already in the cardholder` : `${saved.name} saved to the cardholder`);
            void queryClient.invalidateQueries({ queryKey: ["cardholder-mobile"] });
            router.push("/cardholder");
          }).catch((error) => toast(error instanceof Error ? error.message : "Could not save the card", "err"));
        }).catch(() => undefined);
      }, 700);
    }).catch(() => toast("Camera permission is required. Use Album to choose a card image.", "err"));
    return () => {
      stopped = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [mode, queryClient, router, toast]);

  async function capture() {
    if (mode === "Batch") {
      album.current?.click();
      return;
    }
    const node = video.current;
    if (!node || !node.videoWidth) return;
    const canvas = document.createElement("canvas");
    const cropW = node.videoWidth * 0.86;
    const cropH = Math.min(node.videoHeight * 0.7, cropW / 1.7);
    canvas.width = cropW;
    canvas.height = cropH;
    canvas.getContext("2d")?.drawImage(node, (node.videoWidth - cropW) / 2, (node.videoHeight - cropH) / 2, cropW, cropH, 0, 0, cropW, cropH);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) return;
    ingest.mutate([new File([blob], "camera.jpg", { type: "image/jpeg" })]);
  }

  async function save() {
    if (!active || !draft || saving) return;
    setSaving(true);
    try {
      await api(`/scans/${active.id}`, { method: "PATCH", body: JSON.stringify(draft) });
      await api(`/scans/${active.id}/save`, { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: ["scans"] });
      await queryClient.invalidateQueries({ queryKey: ["cardholder-mobile"] });
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setActive(null);
      toast("Saved to the cardholder");
      if (mode === "Single") router.push("/cardholder");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-black text-white">
      <div className="flex items-center gap-3 px-3 py-3">
        <button type="button" aria-label="Close scanner" className="grid h-9 w-9 place-items-center" onClick={() => router.push("/cardholder")}><X /></button>
        <div className="mx-auto flex rounded-full bg-white/15 p-1 text-sm">
          <button type="button" className={`rounded-full px-4 py-1 ${accuracy === "basic" ? "bg-white text-black" : ""}`} onClick={() => setAccuracy("basic")}>Basic</button>
          <button type="button" className={`rounded-full px-4 py-1 ${accuracy === "high" ? "bg-white text-black" : ""}`} onClick={() => setAccuracy("high")}>High Accuracy</button>
        </div>
        <span className="w-9" />
      </div>
      <div className="relative min-h-0 flex-1">
        {mode === "Batch" ? <div className="grid h-full place-items-center px-8 text-center text-sm text-white/80">Choose several card images from Album. Each one uses the existing scan pipeline.</div> : <video ref={video} autoPlay playsInline muted className="h-full w-full object-cover" />}
        <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-white/80" />
        {ingest.isPending ? <div className="absolute inset-x-8 bottom-6 rounded-xl bg-black/70 px-3 py-2 text-center text-sm">Recognizing…</div> : null}
      </div>
      <div className="grid grid-cols-4 px-2 pt-3 text-center text-xs text-white/70">
        {modes.map((item) => <button key={item} type="button" className={mode === item ? "font-semibold text-white" : ""} onClick={() => setMode(item)}>{item}</button>)}
      </div>
      <div className="flex items-center justify-between px-8 py-5" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
        <button type="button" className="grid place-items-center gap-1 text-xs" onClick={() => album.current?.click()}><ImageIcon /> Album</button>
        <button type="button" aria-label="Shutter" data-testid="mobile-shutter" className="grid h-[72px] w-[72px] place-items-center rounded-full border-4 border-white" onClick={() => void capture()}>
          <span className="h-14 w-14 rounded-full bg-white" />
        </button>
        <button type="button" className="w-12 text-center text-sm" aria-label="Cards being recognized" onClick={() => {
          const item = (scans.data ?? []).find((scan) => scan.status === "REVIEW");
          if (!item) return;
          setActive(item);
          setDraft(item.fields);
        }}>{pending}</button>
      </div>
      <input ref={album} className="hidden" type="file" accept="image/*,.pdf" multiple={mode !== "Single"} onChange={(event) => { if (event.target.files?.length) ingest.mutate(Array.from(event.target.files)); event.target.value = ""; }} />
      {active && draft ? (
        <div className="absolute inset-0 z-10 flex flex-col bg-[#f3f5f8] text-[#1c1f23]">
          <div className="flex items-center justify-between bg-[#17324d] px-4 py-3 text-white">
            <button type="button" onClick={() => setActive(null)}>Back</button>
            <span>Review</span>
            <button type="button" onClick={() => void save().catch((error) => toast(error instanceof Error ? error.message : "Could not save", "err"))}>Save</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {active.imageUrl && !active.imageUrl.endsWith(".pdf") ? <img src={active.imageUrl} alt="" className="mb-4 max-h-48 w-full rounded-xl object-contain" /> : null}
            <div className="space-y-3 rounded-2xl bg-white p-4">
              {fields.map((key) => (
                <label key={key} className="block text-xs text-[#66707c]">
                  {key}
                  <input className="mt-1 h-10 w-full rounded-xl border border-[#e6e9ef] px-3 text-sm text-[#1c1f23] outline-none" value={draft[key] || ""} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
