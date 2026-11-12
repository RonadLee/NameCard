"use client";

import { Button, controlClass, Field, PageTitle } from "@/components/ui";
import { api } from "@/lib/api";
import { publicUrl } from "@/lib/signature";
import { useSession } from "@/lib/store";
import type { Card, VirtualBackground } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

const presets = [
  ["Ocean", "#0f4c81", "#1aa3e8"],
  ["Graphite", "#1c1f23", "#5c6570"],
  ["Ember", "#8c2f39", "#f05a4a"],
];

export default function BackgroundEditorPage() {
  const params = useParams<{ id: string }>();
  const creating = params.id === "new";
  const canvas = useRef<HTMLCanvasElement>(null);
  const toast = useSession((state) => state.toast);
  const router = useRouter();
  const queryClient = useQueryClient();
  const cards = useQuery({ queryKey: ["cards", false], queryFn: () => api<Card[]>("/cards") });
  const rows = useQuery({ queryKey: ["backgrounds"], queryFn: () => api<VirtualBackground[]>("/backgrounds") });
  const current = rows.data?.find((row) => row.id === params.id);
  const [name, setName] = useState("Alex Chen");
  const [jobTitle, setJobTitle] = useState("Marketing Manager");
  const [cardId, setCardId] = useState("");
  const [accent, setAccent] = useState("#1aa3e8");
  const [gradient, setGradient] = useState(presets[0]);
  const [platform, setPlatform] = useState("zoom");
  const [showName, setShowName] = useState(true);
  const [showLogo, setShowLogo] = useState(true);
  const [showQr, setShowQr] = useState(true);
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!current) return;
    setName(current.name);
    setJobTitle(current.jobTitle || "");
    setCardId(current.card?.id || "");
    setAccent(current.accent);
    setPlatform(current.platform);
    setShowName(current.showName);
    setShowLogo(current.showLogo);
    setShowQr(current.showQr);
    setPhoto(current.backgroundUrl || null);
  }, [current]);

  useEffect(() => {
    const card = cards.data?.find((item) => item.id === cardId) ?? cards.data?.[0];
    if (card && creating && name === "Alex Chen") {
      setName(card.name);
      setJobTitle(card.jobTitle || "");
      setCardId(card.id);
    }
    void draw(card);
  }, [name, jobTitle, accent, gradient, showName, showLogo, showQr, photo, cardId, cards.data]);

  async function draw(card?: Card) {
    const node = canvas.current;
    if (!node) return;
    const ctx = node.getContext("2d");
    if (!ctx) return;
    node.width = 1280;
    node.height = 720;
    const paint = ctx.createLinearGradient(0, 0, 1280, 720);
    paint.addColorStop(0, gradient[1]);
    paint.addColorStop(1, gradient[2]);
    ctx.fillStyle = paint;
    ctx.fillRect(0, 0, 1280, 720);
    if (photo) {
      const image = await loadImage(photo);
      ctx.drawImage(image, 0, 0, 1280, 720);
    }
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillRect(64, 470, 520, 170);
    if (showLogo) {
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(120, 555, 28, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#1c1f23";
    ctx.font = "600 36px Inter, sans-serif";
    if (showName) ctx.fillText(name || "Your name", showLogo ? 170 : 96, 545);
    ctx.fillStyle = "#5c6570";
    ctx.font = "22px Inter, sans-serif";
    ctx.fillText(jobTitle || "", showLogo ? 170 : 96, 585);
    if (showQr && card) {
      const url = await QRCode.toDataURL(publicUrl(card.qrSlug), { margin: 1, width: 180 });
      const image = await loadImage(url);
      ctx.drawImage(image, 1040, 500, 160, 160);
    }
  }

  async function onUpload(file: File) {
    const body = new FormData();
    body.append("file", file);
    const saved = await api<{ url: string }>("/files", { method: "POST", body });
    setPhoto(saved.url);
  }

  const save = useMutation({
    mutationFn: async () => {
      const blob = await new Promise<Blob | null>((resolve) => canvas.current?.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Could not render the background");
      const body = new FormData();
      body.append("file", new File([blob], "background.png", { type: "image/png" }));
      const file = await api<{ url: string }>("/files", { method: "POST", body });
      return api(creating ? "/backgrounds" : `/backgrounds/${params.id}`, {
        method: creating ? "POST" : "PATCH",
        body: JSON.stringify({ name, jobTitle, cardId: cardId || undefined, accent, platform, showName, showLogo, showQr, backgroundUrl: file.url }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["backgrounds"] });
      toast("Background saved");
      router.push("/backgrounds");
    },
    onError: (error) => toast(error instanceof Error ? error.message : "Could not save", "err"),
  });

  function download() {
    const url = canvas.current?.toDataURL("image/png");
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = `${platform}-background.png`;
    link.click();
  }

  return (
    <div>
      <PageTitle title="Create background" extra={<div className="flex gap-2"><Button variant="ghost" onClick={download}>Download PNG</Button><Button onClick={() => save.mutate()}>Save</Button></div>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <canvas ref={canvas} className="w-full rounded-2xl bg-white shadow-card" />
        <div className="space-y-3 rounded-2xl bg-white p-4 shadow-card">
          <Field label="Name"><input className={controlClass} value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="Job title"><input className={controlClass} value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} /></Field>
          <Field label="Card">
            <select className={controlClass} value={cardId} onChange={(event) => setCardId(event.target.value)}>
              <option value="">No card</option>
              {(cards.data ?? []).map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}
            </select>
          </Field>
          <Field label="Meeting app">
            <select className={controlClass} value={platform} onChange={(event) => setPlatform(event.target.value)}>
              <option value="zoom">Zoom</option>
              <option value="teams">Microsoft Teams</option>
              <option value="webex">Webex</option>
              <option value="meet">Google Meet</option>
            </select>
          </Field>
          <div className="flex gap-2">
            {presets.map((preset) => <button key={preset[0]} className="h-8 flex-1 rounded-full text-xs text-white" style={{ background: preset[2] }} onClick={() => { setGradient(preset); setPhoto(null); }}>{preset[0]}</button>)}
          </div>
          <Field label="Upload background"><input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0])} /></Field>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={showName} onChange={(event) => setShowName(event.target.checked)} /> Employee name</label>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={showLogo} onChange={(event) => setShowLogo(event.target.checked)} /> Company mark</label>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={showQr} onChange={(event) => setShowQr(event.target.checked)} /> QR code</label>
          <p className="text-xs text-[#8b919a]">Export is 1280×720, which Zoom, Teams, Webex, and Meet accept as a custom background.</p>
        </div>
      </div>
    </div>
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
