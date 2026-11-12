"use client";

import { Button, controlClass, Field, PageTitle } from "@/components/ui";
import { api } from "@/lib/api";
import { mailClients, signatureHtml } from "@/lib/signature";
import { useSession } from "@/lib/store";
import type { Card, Signature } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import JSZip from "jszip";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SignatureEditorPage() {
  const params = useParams<{ id: string }>();
  const creating = params.id === "new";
  const toast = useSession((state) => state.toast);
  const router = useRouter();
  const queryClient = useQueryClient();
  const cards = useQuery({ queryKey: ["cards", false], queryFn: () => api<Card[]>("/cards") });
  const existing = useQuery({ queryKey: ["signatures"], queryFn: () => api<Signature[]>("/signatures") });
  const current = existing.data?.find((item) => item.id === params.id);
  const [cardId, setCardId] = useState("");
  const [name, setName] = useState("Work signature");
  const [template, setTemplate] = useState("classic");
  const [theme, setTheme] = useState("#1aa3e8");
  const [showQr, setShowQr] = useState(true);
  const [showPhoto, setShowPhoto] = useState(true);
  const [showSocial, setShowSocial] = useState(true);

  useEffect(() => {
    if (current) {
      setCardId(current.card.id);
      setName(current.name);
      setTemplate(current.template);
      setTheme(current.theme);
      setShowQr(current.showQr);
      setShowPhoto(current.showPhoto);
      setShowSocial(current.showSocial);
    } else if (cards.data?.[0] && !cardId) setCardId(cards.data[0].id);
  }, [current, cards.data, cardId]);

  const card = cards.data?.find((item) => item.id === cardId);
  const html = card ? signatureHtml({ template, theme, showQr, showPhoto, showSocial }, card) : "";

  const save = useMutation({
    mutationFn: () => api(creating ? "/signatures" : `/signatures/${params.id}`, {
      method: creating ? "POST" : "PATCH",
      body: JSON.stringify({ cardId, name, template, theme, showQr, showPhoto, showSocial }),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["signatures"] });
      toast("Signature saved");
      router.push("/signatures");
    },
    onError: (error) => toast(error instanceof Error ? error.message : "Could not save", "err"),
  });

  async function downloadPackage() {
    const zip = new JSZip();
    zip.file("signature.html", html);
    zip.file("install.txt", mailClients.map((client) => `${client.name}\n${client.steps}`).join("\n\n"));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "signature-package.zip";
    link.click();
  }

  return (
    <div>
      <PageTitle title={creating ? "Create signature" : "Edit signature"} extra={<Button onClick={() => save.mutate()}>Save</Button>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4 rounded-2xl bg-white p-5 shadow-card">
          <div className="rounded-xl border border-[#eef1f4] p-4" dangerouslySetInnerHTML={{ __html: html || "<p>Choose a card to preview the signature.</p>" }} />
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Name"><input className={controlClass} value={name} onChange={(event) => setName(event.target.value)} /></Field>
            <Field label="Card">
              <select className={controlClass} value={cardId} onChange={(event) => setCardId(event.target.value)}>
                {(cards.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="Template">
              <select className={controlClass} value={template} onChange={(event) => setTemplate(event.target.value)}>
                <option value="classic">Classic</option>
                <option value="compact">Compact</option>
                <option value="banner">Banner</option>
                <option value="social">Social</option>
              </select>
            </Field>
            <Field label="Theme"><input className="h-10 w-full" type="color" value={theme} onChange={(event) => setTheme(event.target.value)} /></Field>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label><input type="checkbox" checked={showQr} onChange={(event) => setShowQr(event.target.checked)} /> QR code</label>
            <label><input type="checkbox" checked={showPhoto} onChange={(event) => setShowPhoto(event.target.checked)} /> Profile photo</label>
            <label><input type="checkbox" checked={showSocial} onChange={(event) => setShowSocial(event.target.checked)} /> Social icons</label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => { void navigator.clipboard.writeText(html); toast("HTML copied"); }}>Copy HTML</Button>
            <Button variant="ghost" onClick={() => downloadPackage()}>Download package</Button>
            {!creating ? <Button variant="ghost" onClick={async () => { await api(`/signatures/${params.id}`, { method: "DELETE" }); router.push("/signatures"); }}>Delete</Button> : null}
          </div>
        </div>
        <aside className="space-y-3">
          {mailClients.map((client) => (
            <div key={client.name} className="rounded-2xl bg-white p-4 text-sm shadow-card">
              <div className="font-medium">{client.name}</div>
              <p className="mt-1 text-[#66707c]">{client.steps}</p>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
