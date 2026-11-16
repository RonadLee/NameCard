"use client";

import { CardFace } from "@/components/card-face";
import { Button, controlClass, Field, PageTitle } from "@/components/ui";
import { api } from "@/lib/api";
import { useSession } from "@/lib/store";
import type { Card, CustomField, SocialLink } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const empty: Partial<Card> = {
  name: "",
  nameZh: "",
  nameEn: "",
  jobTitle: "",
  department: "",
  company: "",
  phone: "",
  mobile: "",
  whatsapp: "",
  email: "",
  website: "",
  address: "",
  notes: "",
  socials: [],
  customFields: [],
  tags: [],
  template: "classic",
  themeColor: "#1aa3e8",
  font: "Inter",
  visibility: "PRIVATE",
};

export function CardEditor({ id }: { id?: string }) {
  const toast = useSession((state) => state.toast);
  const router = useRouter();
  const queryClient = useQueryClient();
  const existing = useQuery({ queryKey: ["card", id], queryFn: () => api<Card>(`/cards/${id}`), enabled: Boolean(id) });
  const [card, setCard] = useState<Partial<Card>>(empty);
  useEffect(() => {
    if (existing.data) setCard(existing.data);
  }, [existing.data]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: card.name || "Untitled",
        nameZh: card.nameZh || "",
        nameEn: card.nameEn || "",
        jobTitle: card.jobTitle || "",
        department: card.department || "",
        company: card.company || "",
        phone: card.phone || "",
        mobile: card.mobile || "",
        whatsapp: card.whatsapp || "",
        email: card.email || "",
        website: card.website || "",
        address: card.address || "",
        notes: card.notes || "",
        socials: card.socials ?? [],
        customFields: card.customFields ?? [],
        tags: card.tags ?? [],
        logoUrl: card.logoUrl || "",
        photoUrl: card.photoUrl || "",
        bannerUrl: card.bannerUrl || "",
        template: card.template || "classic",
        themeColor: card.themeColor || "#1aa3e8",
        font: card.font || "Inter",
        visibility: card.visibility || "PRIVATE",
      };
      return api<Card>(id ? `/cards/${id}` : "/cards", { method: id ? "PATCH" : "POST", body: JSON.stringify(payload) });
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["cards"] });
      toast("Card saved");
      router.push(`/cards/${saved.id}`);
    },
    onError: (error) => toast(error instanceof Error ? error.message : "Could not save", "err"),
  });

  function set<K extends keyof Card>(key: K, value: Card[K]) {
    setCard((current) => ({ ...current, [key]: value }));
  }

  async function upload(key: "logoUrl" | "photoUrl" | "bannerUrl", file: File) {
    const body = new FormData();
    body.append("file", file);
    const saved = await api<{ url: string }>("/files", { method: "POST", body });
    set(key, saved.url);
  }

  return (
    <div>
      <PageTitle title={id ? "Edit card" : "Create card"} extra={<span className="flex gap-2">{id ? <Button variant="ghost" onClick={async () => { try { await api(`/cards/${id}/publish-request`, { method: "POST" }); toast("Sent to an admin for approval"); } catch (error) { toast(error instanceof Error ? error.message : "Could not submit", "err"); } }}>Submit for approval</Button> : null}<Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></span>} />
      <div className="grid items-start gap-6 lg:grid-cols-[360px_1fr]">
        <div className="rounded-2xl bg-white p-4 shadow-card">
          <CardFace card={card} />
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            {["classic", "split", "banner"].map((template) => (
              <button key={template} className={`rounded-xl border px-2 py-2 capitalize ${card.template === template ? "border-[#1aa3e8] text-[#1aa3e8]" : "border-[#e6e8ee]"}`} onClick={() => set("template", template)}>{template}</button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 rounded-2xl bg-white p-5 shadow-card md:grid-cols-2">
          <Field label="Name"><input className={controlClass} value={card.name || ""} onChange={(event) => set("name", event.target.value)} /></Field>
          <Field label="Chinese name"><input className={controlClass} value={card.nameZh || ""} onChange={(event) => set("nameZh", event.target.value)} /></Field>
          <Field label="English name"><input className={controlClass} value={card.nameEn || ""} onChange={(event) => set("nameEn", event.target.value)} /></Field>
          <Field label="Job title"><input className={controlClass} value={card.jobTitle || ""} onChange={(event) => set("jobTitle", event.target.value)} /></Field>
          <Field label="Department"><input className={controlClass} value={card.department || ""} onChange={(event) => set("department", event.target.value)} /></Field>
          <Field label="Company"><input className={controlClass} value={card.company || ""} onChange={(event) => set("company", event.target.value)} /></Field>
          <Field label="Phone"><input className={controlClass} value={card.phone || ""} onChange={(event) => set("phone", event.target.value)} /></Field>
          <Field label="Mobile"><input className={controlClass} value={card.mobile || ""} onChange={(event) => set("mobile", event.target.value)} /></Field>
          <Field label="WhatsApp"><input className={controlClass} value={card.whatsapp || ""} onChange={(event) => set("whatsapp", event.target.value)} /></Field>
          <Field label="Email"><input className={controlClass} value={card.email || ""} onChange={(event) => set("email", event.target.value)} /></Field>
          <Field label="Website"><input className={controlClass} value={card.website || ""} onChange={(event) => set("website", event.target.value)} /></Field>
          <Field label="Address"><input className={controlClass} value={card.address || ""} onChange={(event) => set("address", event.target.value)} /></Field>
          <Field label="Theme">
            <input className="h-10 w-full" type="color" value={card.themeColor || "#1aa3e8"} onChange={(event) => set("themeColor", event.target.value)} />
          </Field>
          <Field label="Font">
            <select className={controlClass} value={card.font || "Inter"} onChange={(event) => set("font", event.target.value)}>
              <option>Inter</option>
              <option>Georgia</option>
              <option>Trebuchet MS</option>
            </select>
          </Field>
          <Field label="Visibility">
            <select className={controlClass} value={card.visibility || "PRIVATE"} onChange={(event) => set("visibility", event.target.value as Card["visibility"])}>
              <option value="PRIVATE">Private</option>
              <option value="TEAM">Team</option>
              <option value="PUBLIC">Public</option>
            </select>
          </Field>
          <Field label="Tags">
            <input className={controlClass} value={(card.tags || []).join(", ")} onChange={(event) => set("tags", event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean))} />
          </Field>
          <Field label="Logo"><input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && upload("logoUrl", event.target.files[0])} /></Field>
          <Field label="Photo"><input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && upload("photoUrl", event.target.files[0])} /></Field>
          <Field label="Banner"><input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && upload("bannerUrl", event.target.files[0])} /></Field>
          <div className="md:col-span-2">
            <Field label="Notes"><textarea className={`${controlClass} h-24 py-2`} value={card.notes || ""} onChange={(event) => set("notes", event.target.value)} /></Field>
          </div>
          <SocialEditor socials={card.socials || []} onChange={(socials) => set("socials", socials)} />
          <CustomEditor fields={card.customFields || []} onChange={(customFields) => set("customFields", customFields)} />
        </div>
      </div>
    </div>
  );
}

function SocialEditor({ socials, onChange }: { socials: SocialLink[]; onChange: (socials: SocialLink[]) => void }) {
  return (
    <div className="md:col-span-2 space-y-2">
      <div className="text-[13px] text-[#66707c]">Social media</div>
      {socials.map((item, index) => (
        <div key={index} className="grid grid-cols-[140px_1fr_auto] gap-2">
          <input className={controlClass} value={item.network} onChange={(event) => onChange(socials.map((row, rowIndex) => rowIndex === index ? { ...row, network: event.target.value } : row))} />
          <input className={controlClass} value={item.url} onChange={(event) => onChange(socials.map((row, rowIndex) => rowIndex === index ? { ...row, url: event.target.value } : row))} />
          <Button variant="ghost" type="button" onClick={() => onChange(socials.filter((_, rowIndex) => rowIndex !== index))}>Remove</Button>
        </div>
      ))}
      <Button variant="soft" type="button" onClick={() => onChange([...socials, { network: "linkedin", url: "" }])}>Add social</Button>
    </div>
  );
}

function CustomEditor({ fields, onChange }: { fields: CustomField[]; onChange: (fields: CustomField[]) => void }) {
  return (
    <div className="md:col-span-2 space-y-2">
      <div className="text-[13px] text-[#66707c]">Custom fields</div>
      {fields.map((item, index) => (
        <div key={index} className="grid grid-cols-[140px_1fr_auto] gap-2">
          <input className={controlClass} value={item.label} onChange={(event) => onChange(fields.map((row, rowIndex) => rowIndex === index ? { ...row, label: event.target.value } : row))} />
          <input className={controlClass} value={item.value} onChange={(event) => onChange(fields.map((row, rowIndex) => rowIndex === index ? { ...row, value: event.target.value } : row))} />
          <Button variant="ghost" type="button" onClick={() => onChange(fields.filter((_, rowIndex) => rowIndex !== index))}>Remove</Button>
        </div>
      ))}
      <Button variant="soft" type="button" onClick={() => onChange([...fields, { label: "", value: "" }])}>Add field</Button>
    </div>
  );
}
