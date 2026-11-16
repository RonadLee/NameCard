"use client";

import { api } from "@/lib/api";
import { useSession } from "@/lib/store";
import type { CardDetails, Contact } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ChevronDown, ChevronUp } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const maxBytes = 12 * 1024 * 1024;
const imNetworks = ["QQ", "WeChat", "Skype", "WhatsApp", "Line"];
const socialNetworks = ["Twitter", "LinkedIn", "Facebook", "Instagram", "Weibo"];
const dateKinds = ["Birthday", "Anniversary", "Other"];
const imNames = new Set(["qq", "wechat", "whatsapp", "skype", "line"]);

type Address = { street: string; city: string; state: string; zip: string; country: string };
type Pair = { network: string; value: string };
type Draft = {
  firstName: string;
  lastName: string;
  namePrefix: string;
  phoneticFirst: string;
  middleName: string;
  phoneticLast: string;
  nameSuffix: string;
  nameZh: string;
  nameEn: string;
  nickname: string;
  profileUrl: string;
  frontUrl: string;
  frontKind: string;
  backUrl: string;
  backKind: string;
  mobiles: string[];
  telephones: string[];
  faxes: string[];
  emails: string[];
  companies: string[];
  department: string;
  title: string;
  phoneticCompany: string;
  websites: string[];
  addresses: Address[];
  ims: Pair[];
  socials: Pair[];
  keyDates: Pair[];
  dateReceived: string;
  groups: string[];
  confidence: Record<string, number>;
  note: string;
};

type Preview = {
  imageUrl: string;
  kind: "image" | "pdf";
  note: string;
  fields: {
    name: string;
    nameZh: string;
    nameEn: string;
    company: string;
    jobTitle: string;
    email: string;
    mobile: string;
    phone: string;
    website: string;
    address: string;
    socials: { network: string; url: string }[];
    confidence: Record<string, number>;
  };
  extras: { firstName: string; lastName: string; fax: string; nickname: string; birthday: string };
};

const emptyAddress = (): Address => ({ street: "", city: "", state: "", zip: "", country: "" });

function blank(): Draft {
  return {
    firstName: "", lastName: "", namePrefix: "", phoneticFirst: "", middleName: "", phoneticLast: "", nameSuffix: "",
    nameZh: "", nameEn: "", nickname: "", profileUrl: "", frontUrl: "", frontKind: "image", backUrl: "", backKind: "image",
    mobiles: [""], telephones: [""], faxes: [""], emails: [""], companies: [""], department: "", title: "", phoneticCompany: "",
    websites: [""], addresses: [emptyAddress()], ims: [{ network: "QQ", value: "" }], socials: [{ network: "Twitter", value: "" }],
    keyDates: [{ network: "Birthday", value: "" }], dateReceived: "", groups: [], confidence: {}, note: "",
  };
}

function splitName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length || /^[\u4e00-\u9fff]/.test(parts[0] || "")) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

function fromContact(contact: Contact): Draft {
  const details: CardDetails = contact.details && typeof contact.details === "object" ? contact.details : {};
  const split = details.firstName || details.lastName ? { first: "", last: "" } : splitName(contact.nameEn || contact.name);
  const socials = details.socialRows?.length
    ? details.socialRows
    : contact.socials.length
      ? contact.socials.map((item) => ({ network: item.network, value: item.url }))
      : [{ network: "Twitter", value: "" }];
  return {
    ...blank(),
    firstName: details.firstName || split.first,
    lastName: details.lastName || split.last,
    namePrefix: details.namePrefix || "",
    phoneticFirst: details.phoneticFirst || "",
    middleName: details.middleName || "",
    phoneticLast: details.phoneticLast || "",
    nameSuffix: details.nameSuffix || "",
    nameZh: contact.nameZh || "",
    nameEn: contact.nameEn || "",
    nickname: details.nickname || "",
    profileUrl: contact.imageUrl || "",
    frontUrl: contact.cardImageUrl || "",
    frontKind: details.frontKind || "image",
    backUrl: contact.cardBackUrl || "",
    backKind: details.backKind || "image",
    mobiles: details.mobiles?.length ? details.mobiles : [contact.mobile || ""],
    telephones: details.telephones?.length ? details.telephones : [contact.phone || ""],
    faxes: details.faxes?.length ? details.faxes : [""],
    emails: details.emails?.length ? details.emails : [contact.email || ""],
    companies: details.companies?.length ? details.companies : [contact.company || ""],
    department: contact.department || "",
    title: contact.jobTitle || "",
    phoneticCompany: details.phoneticCompany || "",
    websites: details.websites?.length ? details.websites : [contact.website || ""],
    addresses: details.addresses?.length ? details.addresses : [{ ...emptyAddress(), street: contact.address || "" }],
    ims: details.ims?.length ? details.ims : [{ network: "QQ", value: contact.whatsapp || "" }],
    socials,
    keyDates: details.keyDates?.length ? details.keyDates.map((item) => ({ network: item.kind || "Birthday", value: item.value })) : [{ network: "Birthday", value: "" }],
    dateReceived: details.dateReceived || "",
    groups: contact.groups?.length ? contact.groups : contact.groupName ? [contact.groupName] : [],
    confidence: details.confidence || {},
  };
}

function putFirst(list: string[], value: string) {
  if (!value) return list;
  const next = list.length ? [...list] : [""];
  next[0] = value;
  return next;
}

function applyOcr(draft: Draft, body: Preview): Draft {
  const next: Draft = { ...draft, confidence: { ...draft.confidence }, frontUrl: body.imageUrl, frontKind: body.kind, note: body.note };
  const mark = (key: string, value: string, score?: number) => {
    if (value && score) next.confidence[key] = score;
  };
  if (body.extras.firstName) next.firstName = body.extras.firstName;
  if (body.extras.lastName) next.lastName = body.extras.lastName;
  mark("firstName", next.firstName, body.fields.confidence.name);
  mark("lastName", next.lastName, body.fields.confidence.name);
  if (body.fields.nameZh) next.nameZh = body.fields.nameZh;
  mark("nameZh", body.fields.nameZh, body.fields.confidence.nameZh);
  if (body.fields.nameEn) next.nameEn = body.fields.nameEn;
  mark("nameEn", body.fields.nameEn, body.fields.confidence.nameEn);
  if (body.extras.nickname) next.nickname = body.extras.nickname;
  mark("nickname", body.extras.nickname, 0.6);
  const phone = (body.fields.phone || "").split(/\n/)[0]?.trim() ?? "";
  next.mobiles = putFirst(draft.mobiles, body.fields.mobile);
  mark("mobile", body.fields.mobile, body.fields.confidence.mobile);
  next.telephones = putFirst(draft.telephones, phone);
  mark("phone", phone, body.fields.confidence.phone);
  next.faxes = putFirst(draft.faxes, body.extras.fax);
  mark("fax", body.extras.fax, 0.66);
  next.emails = putFirst(draft.emails, body.fields.email);
  mark("email", body.fields.email, body.fields.confidence.email);
  next.companies = putFirst(draft.companies, body.fields.company);
  mark("company", body.fields.company, body.fields.confidence.company);
  if (body.fields.jobTitle) next.title = body.fields.jobTitle;
  mark("title", body.fields.jobTitle, body.fields.confidence.jobTitle);
  next.websites = putFirst(draft.websites, body.fields.website);
  mark("website", body.fields.website, body.fields.confidence.website);
  if (body.fields.address) {
    next.addresses = [{ ...(draft.addresses[0] ?? emptyAddress()), street: body.fields.address }, ...draft.addresses.slice(1)];
    mark("address", body.fields.address, body.fields.confidence.address);
  }
  if (body.extras.birthday) {
    next.keyDates = [{ network: "Birthday", value: body.extras.birthday }, ...draft.keyDates.slice(1)];
    mark("birthday", body.extras.birthday, 0.55);
  }
  const ims = (body.fields.socials ?? []).filter((item) => imNames.has(item.network.toLowerCase()));
  const rest = (body.fields.socials ?? []).filter((item) => !imNames.has(item.network.toLowerCase()));
  if (ims.length) next.ims = ims.map((item) => ({ network: item.network, value: item.url }));
  if (rest.length) next.socials = rest.map((item) => ({ network: item.network, value: item.url }));
  return next;
}

function payload(draft: Draft) {
  const address = draft.addresses[0] ?? emptyAddress();
  const details: CardDetails = {
    firstName: draft.firstName,
    lastName: draft.lastName,
    namePrefix: draft.namePrefix,
    phoneticFirst: draft.phoneticFirst,
    middleName: draft.middleName,
    phoneticLast: draft.phoneticLast,
    nameSuffix: draft.nameSuffix,
    nickname: draft.nickname,
    phoneticCompany: draft.phoneticCompany,
    mobiles: draft.mobiles,
    telephones: draft.telephones,
    faxes: draft.faxes,
    emails: draft.emails,
    companies: draft.companies,
    websites: draft.websites,
    addresses: draft.addresses,
    ims: draft.ims,
    socialRows: draft.socials,
    keyDates: draft.keyDates.map((item) => ({ kind: item.network, value: item.value })),
    dateReceived: draft.dateReceived,
    confidence: draft.confidence,
    frontKind: draft.frontKind,
    backKind: draft.backKind,
  };
  return {
    name: [draft.firstName, draft.middleName, draft.lastName].filter(Boolean).join(" ") || draft.nameZh || draft.nameEn,
    nameZh: draft.nameZh,
    nameEn: draft.nameEn || [draft.firstName, draft.lastName].filter(Boolean).join(" "),
    mobile: draft.mobiles.find(Boolean) || "",
    phone: draft.telephones.find(Boolean) || "",
    email: draft.emails.find(Boolean) || "",
    company: draft.companies.find(Boolean) || "",
    department: draft.department,
    jobTitle: draft.title,
    website: draft.websites.find(Boolean) || "",
    address: [address.street, address.city, address.state, address.zip, address.country].filter(Boolean).join(", "),
    whatsapp: draft.ims.find((item) => item.network.toLowerCase() === "whatsapp")?.value || "",
    socials: draft.socials.filter((item) => item.value).map((item) => ({ network: item.network, url: item.value })),
    imageUrl: draft.profileUrl,
    cardImageUrl: draft.frontUrl,
    cardBackUrl: draft.backUrl,
    groups: draft.groups,
    details,
  };
}

function allowedFile(file: File) {
  const named = file.name.toLowerCase();
  return ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type) || /\.(jpe?g|png|webp|pdf)$/.test(named);
}

export function CardForm({ contactId }: { contactId?: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const toast = useSession((state) => state.toast);
  const queryClient = useQueryClient();
  const existing = useQuery({ queryKey: ["contact", contactId], enabled: Boolean(contactId), queryFn: () => api<Contact>(`/contacts/${contactId}`) });
  const groups = useQuery({ queryKey: ["contact-groups", "mine"], queryFn: () => api<{ groups: { name: string; count: number }[] }>("/contacts/groups?scope=mine") });
  const [draft, setDraft] = useState<Draft>(blank);
  const [hydrated, setHydrated] = useState(!contactId);
  const [expanded, setExpanded] = useState(false);
  const [reading, setReading] = useState(false);
  const [over, setOver] = useState("");

  useEffect(() => {
    if (!existing.data || hydrated) return;
    setDraft(fromContact(existing.data));
    setHydrated(true);
  }, [existing.data, hydrated]);

  function patch(partial: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  async function take(file: File, side: "front" | "back" | "profile") {
    if (file.size > maxBytes) return toast("File must be 12 MB or smaller", "err");
    if (side === "profile" && !file.type.startsWith("image/")) return toast("Use an image for the profile photo", "err");
    if (side !== "profile" && !allowedFile(file)) return toast("Use a JPG, PNG, WEBP, or PDF", "err");
    const kind = file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "image";
    if (side === "front") {
      setReading(true);
      patch({ frontUrl: URL.createObjectURL(file), frontKind: kind, note: "" });
      try {
        const body = new FormData();
        body.append("file", file);
        const result = await api<Preview>("/scans/preview", { method: "POST", body });
        setDraft((current) => applyOcr(current, result));
        toast(result.fields.name || result.extras.firstName ? "Card read. Check the highlighted fields." : "No text found. Enter the fields yourself.");
      } catch (error) {
        toast(error instanceof Error ? error.message : "Could not read the card", "err");
      } finally {
        setReading(false);
      }
      return;
    }
    try {
      const body = new FormData();
      body.append("file", file);
      const saved = await api<{ url: string }>("/files", { method: "POST", body });
      patch(side === "back" ? { backUrl: saved.url, backKind: kind } : { profileUrl: saved.url });
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not upload the file", "err");
    }
  }

  const save = useMutation({
    mutationFn: () => {
      const body = payload(draft);
      if (!body.name.trim()) throw new Error("Enter a first or last name");
      if (!contactId && !draft.frontUrl) throw new Error("Add the front of the card");
      if (draft.frontUrl.startsWith("blob:")) throw new Error("Wait for the card image to finish uploading");
      return contactId
        ? api<{ id: string }>(`/contacts/${contactId}`, { method: "PATCH", body: JSON.stringify(body) })
        : api<{ id: string }>("/contacts", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["cardholder"] });
      await queryClient.invalidateQueries({ queryKey: ["contact-groups"] });
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
      await queryClient.invalidateQueries({ queryKey: ["contact", saved.id] });
      await queryClient.invalidateQueries({ queryKey: ["cardholder-mobile"] });
      toast(contactId ? "Card saved" : "Card added");
      const suffix = search.toString() ? `?${search.toString()}` : "";
      router.push(`/cardholder/${saved.id}${suffix}`);
    },
    onError: (error) => toast(error instanceof Error ? error.message : "Could not save the card", "err"),
  });

  const groupNames = Array.from(new Set([...(groups.data?.groups ?? []).map((item) => item.name), ...draft.groups]));
  const low = (key: string, value: string) => Boolean(value) && (draft.confidence[key] ?? 1) < 0.7;

  if (contactId && !hydrated) {
    return <div className="grid h-64 place-items-center text-sm text-[#8b919a]">{existing.isError ? "Card not found" : "Loading card…"}</div>;
  }

  return (
    <div className="mx-auto max-w-5xl bg-white shadow-sm">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#eceff3] bg-white px-4 py-3">
        <h1 className="text-lg font-medium">{contactId ? "Edit" : "Add Card"}</h1>
        <div className="flex gap-2">
          <button type="button" className="h-9 rounded border border-[#d9dee6] bg-white px-4 text-sm" onClick={() => router.push(contactId ? `/cardholder/${contactId}${search.toString() ? `?${search.toString()}` : ""}` : `/cardholder${search.toString() ? `?${search.toString()}` : ""}`)}>Cancel</button>
          <button type="button" className="h-9 rounded bg-[#1aa3e8] px-4 text-sm font-medium text-white disabled:opacity-50" disabled={save.isPending || reading} onClick={() => save.mutate()}>
            {reading ? "Reading card…" : save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <div className="grid md:grid-cols-[280px_1fr]">
        <div className="border-b border-[#eceff3] p-4 md:border-b-0 md:border-r">
          <div className="mb-3 text-sm text-[#8b919a]">Card image</div>
          <div className="grid grid-cols-2 gap-3">
            <DropBox label="Add front" url={draft.frontUrl} kind={draft.frontKind} active={over === "front"} busy={reading} onFile={(file) => void take(file, "front")} onOver={(value) => setOver(value ? "front" : "")} />
            <DropBox label="Add backside" url={draft.backUrl} kind={draft.backKind} active={over === "back"} onFile={(file) => void take(file, "back")} onOver={(value) => setOver(value ? "back" : "")} />
          </div>
          {draft.note ? <p className="mt-3 text-xs leading-5 text-[#8b919a]">{draft.note}</p> : null}
        </div>
        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto px-4 py-2 md:px-6">
          <Section title="Basic Information" />
          <FormRow label="Profile photo">
            <label className="grid h-14 w-14 cursor-pointer place-items-center overflow-hidden rounded-full bg-[#c5c9ce] text-white">
              {draft.profileUrl ? <img src={draft.profileUrl} alt="" className="h-full w-full object-cover" /> : <Camera size={18} />}
              <input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void take(file, "profile"); event.target.value = ""; }} />
            </label>
          </FormRow>
          <Expand open={expanded}>
            <TextRow label="Name Prefix" value={draft.namePrefix} onChange={(namePrefix) => patch({ namePrefix })} />
          </Expand>
          <FormRow label="First name" low={low("firstName", draft.firstName)}>
            <div className="flex items-center gap-2">
              <input className={inputClass(low("firstName", draft.firstName))} value={draft.firstName} onChange={(event) => patch({ firstName: event.target.value })} />
              <button type="button" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#98a2ad] hover:bg-[#f4f6f8]" aria-expanded={expanded} aria-label={expanded ? "Collapse name fields" : "Expand name fields"} onClick={() => setExpanded((value) => !value)}>
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          </FormRow>
          <Expand open={expanded}>
            <TextRow label="Phonetic First Name" value={draft.phoneticFirst} onChange={(phoneticFirst) => patch({ phoneticFirst })} />
            <TextRow label="Middle Name" value={draft.middleName} onChange={(middleName) => patch({ middleName })} />
          </Expand>
          <TextRow label="Last name" value={draft.lastName} low={low("lastName", draft.lastName)} onChange={(lastName) => patch({ lastName })} />
          <Expand open={expanded}>
            <TextRow label="Phonetic Last Name" value={draft.phoneticLast} onChange={(phoneticLast) => patch({ phoneticLast })} />
            <TextRow label="Name Suffix" value={draft.nameSuffix} onChange={(nameSuffix) => patch({ nameSuffix })} />
            <TextRow label="Chinese name" value={draft.nameZh} low={low("nameZh", draft.nameZh)} onChange={(nameZh) => patch({ nameZh })} />
            <TextRow label="English name" value={draft.nameEn} low={low("nameEn", draft.nameEn)} onChange={(nameEn) => patch({ nameEn })} />
          </Expand>

          <Section title="Contact Info" />
          <Lines label="Mobile" values={draft.mobiles} low={low("mobile", draft.mobiles[0] || "")} onChange={(mobiles) => patch({ mobiles })} />
          <Lines label="Telephone" values={draft.telephones} low={low("phone", draft.telephones[0] || "")} onChange={(telephones) => patch({ telephones })} />
          <Lines label="Fax" values={draft.faxes} low={low("fax", draft.faxes[0] || "")} onChange={(faxes) => patch({ faxes })} />
          <Lines label="Email" values={draft.emails} low={low("email", draft.emails[0] || "")} onChange={(emails) => patch({ emails })} />

          <Section title="Company Info" />
          <Lines label="Company" values={draft.companies} low={low("company", draft.companies[0] || "")} onChange={(companies) => patch({ companies })} />
          <TextRow label="Department" value={draft.department} onChange={(department) => patch({ department })} />
          <TextRow label="Title" value={draft.title} low={low("title", draft.title)} onChange={(title) => patch({ title })} />
          <TextRow label="Phonetic Company" value={draft.phoneticCompany} onChange={(phoneticCompany) => patch({ phoneticCompany })} />
          <Lines label="Website" values={draft.websites} low={low("website", draft.websites[0] || "")} onChange={(websites) => patch({ websites })} />
          {draft.addresses.map((address, index) => (
            <FormRow key={index} label={index === 0 ? "Address" : ""} low={index === 0 && low("address", address.street)}>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input className={inputClass(index === 0 && low("address", address.street))} placeholder="Street" value={address.street} onChange={(event) => patch({ addresses: replace(draft.addresses, index, { ...address, street: event.target.value }) })} />
                  <StepButtons onAdd={() => patch({ addresses: insert(draft.addresses, index, emptyAddress()) })} onRemove={() => patch({ addresses: removeAt(draft.addresses, index, emptyAddress()) })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputClass(false)} placeholder="City" value={address.city} onChange={(event) => patch({ addresses: replace(draft.addresses, index, { ...address, city: event.target.value }) })} />
                  <input className={inputClass(false)} placeholder="State" value={address.state} onChange={(event) => patch({ addresses: replace(draft.addresses, index, { ...address, state: event.target.value }) })} />
                  <input className={inputClass(false)} placeholder="Zip" value={address.zip} onChange={(event) => patch({ addresses: replace(draft.addresses, index, { ...address, zip: event.target.value }) })} />
                  <input className={inputClass(false)} placeholder="Country" value={address.country} onChange={(event) => patch({ addresses: replace(draft.addresses, index, { ...address, country: event.target.value }) })} />
                </div>
              </div>
            </FormRow>
          ))}

          <Section title="More" />
          <TextRow label="Nickname" value={draft.nickname} low={low("nickname", draft.nickname)} onChange={(nickname) => patch({ nickname })} />
          <Pairs label="IM" options={imNetworks} rows={draft.ims} onChange={(ims) => patch({ ims })} />
          <Pairs label="Social Network" options={socialNetworks} rows={draft.socials} onChange={(socials) => patch({ socials })} />
          <Pairs label="Key Dates" options={dateKinds} rows={draft.keyDates} date low={low("birthday", draft.keyDates[0]?.value || "")} onChange={(keyDates) => patch({ keyDates })} />
          <FormRow label="Date Received">
            <input className={inputClass(false)} type="date" value={draft.dateReceived} onChange={(event) => patch({ dateReceived: event.target.value })} />
          </FormRow>

          <Section title="Group" />
          <div className="flex flex-wrap gap-x-4 gap-y-2 py-2">
            {groupNames.map((name) => (
              <label key={name} className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.groups.includes(name)} onChange={(event) => patch({ groups: event.target.checked ? [...draft.groups, name] : draft.groups.filter((item) => item !== name) })} />
                {name}
              </label>
            ))}
            {!groupNames.length ? <p className="text-sm text-[#8b919a]">Create a group from the cardholder list, then assign it here.</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function DropBox({ label, url, kind, active, busy, onFile, onOver }: { label: string; url: string; kind: string; active: boolean; busy?: boolean; onFile: (file: File) => void; onOver: (active: boolean) => void }) {
  return (
    <label
      className={`grid h-28 cursor-pointer place-items-center overflow-hidden rounded border border-dashed text-sm text-[#98a2ad] ${active ? "border-[#1aa3e8] bg-[#f3fbff]" : "border-[#d5dbe3] bg-[#fafbfc]"}`}
      onDragOver={(event) => { event.preventDefault(); onOver(true); }}
      onDragLeave={() => onOver(false)}
      onDrop={(event) => { event.preventDefault(); onOver(false); const file = event.dataTransfer.files[0]; if (file) onFile(file); }}
    >
      {url && kind !== "pdf" ? <img src={url} alt="" className="max-h-24 max-w-full object-contain" /> : url ? <span>PDF attached</span> : <span>{busy ? "Reading…" : `+ ${label}`}</span>}
      <input className="hidden" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); event.target.value = ""; }} />
    </label>
  );
}

function Section({ title }: { title: string }) {
  return (
    <div className="mb-1 mt-4 flex items-center gap-3 text-sm text-[#98a2ad]">
      <span className="shrink-0">{title}</span>
      <span className="h-px flex-1 bg-[#eceff3]" />
    </div>
  );
}

function Expand({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

function FormRow({ label, low, children }: { label: string; low?: boolean; children: React.ReactNode }) {
  return (
    <div className={`grid grid-cols-1 items-start gap-1 border-b border-[#f4f6f8] py-2.5 sm:grid-cols-[148px_1fr] sm:items-center sm:gap-3 ${low ? "bg-amber-50/60" : ""}`}>
      <div className="text-sm text-[#66707c]">{label}</div>
      {children}
    </div>
  );
}

function inputClass(low: boolean) {
  return `h-9 w-full rounded border px-3 text-sm outline-none focus:border-[#1aa3e8] ${low ? "border-amber-400 bg-amber-50" : "border-[#e1e4ea] bg-white"}`;
}

function TextRow({ label, value, low, onChange }: { label: string; value: string; low?: boolean; onChange: (value: string) => void }) {
  return (
    <FormRow label={label} low={low}>
      <input className={inputClass(Boolean(low))} aria-invalid={low || undefined} title={low ? "Check this value" : undefined} value={value} onChange={(event) => onChange(event.target.value)} />
    </FormRow>
  );
}

function Lines({ label, values, low, onChange }: { label: string; values: string[]; low?: boolean; onChange: (values: string[]) => void }) {
  const rows = values.length ? values : [""];
  return (
    <>
      {rows.map((value, index) => (
        <FormRow key={`${label}-${index}`} label={index === 0 ? label : ""} low={index === 0 && low}>
          <div className="flex items-center gap-2">
            <input className={inputClass(Boolean(index === 0 && low))} aria-invalid={index === 0 && low ? true : undefined} title={index === 0 && low ? "Check this value" : undefined} value={value} onChange={(event) => onChange(replace(rows, index, event.target.value))} />
            <StepButtons onAdd={() => onChange(insert(rows, index, ""))} onRemove={() => onChange(removeAt(rows, index, ""))} />
          </div>
        </FormRow>
      ))}
    </>
  );
}

function Pairs({ label, options, rows, date, low, onChange }: { label: string; options: string[]; rows: Pair[]; date?: boolean; low?: boolean; onChange: (rows: Pair[]) => void }) {
  const list = rows.length ? rows : [{ network: options[0], value: "" }];
  return (
    <>
      {list.map((row, index) => (
        <FormRow key={`${label}-${index}`} label={index === 0 ? label : ""} low={index === 0 && low}>
          <div className="flex items-center gap-2">
            <select className="h-9 rounded border border-[#e1e4ea] bg-white px-2 text-sm" value={row.network} onChange={(event) => onChange(replace(list, index, { ...row, network: event.target.value }))}>
              {options.map((option) => <option key={option}>{option}</option>)}
            </select>
            <input className={inputClass(Boolean(index === 0 && low))} type={date ? "date" : "text"} value={row.value} onChange={(event) => onChange(replace(list, index, { ...row, value: event.target.value }))} />
            <StepButtons onAdd={() => onChange(insert(list, index, { network: options[0], value: "" }))} onRemove={() => onChange(removeAt(list, index, { network: options[0], value: "" }))} />
          </div>
        </FormRow>
      ))}
    </>
  );
}

function StepButtons({ onAdd, onRemove }: { onAdd: () => void; onRemove: () => void }) {
  return (
    <div className="flex shrink-0 gap-1">
      <button type="button" className="grid h-5 w-5 place-items-center rounded-full bg-[#e74c3c] text-xs text-white" aria-label="Remove" onClick={onRemove}>–</button>
      <button type="button" className="grid h-5 w-5 place-items-center rounded-full bg-[#2ecc71] text-xs text-white" aria-label="Add" onClick={onAdd}>+</button>
    </div>
  );
}

function replace<T>(list: T[], index: number, value: T) {
  return list.map((item, itemIndex) => (itemIndex === index ? value : item));
}

function insert<T>(list: T[], index: number, value: T) {
  return [...list.slice(0, index + 1), value, ...list.slice(index + 1)];
}

function removeAt<T>(list: T[], index: number, empty: T) {
  if (list.length === 1) return [empty];
  return list.filter((_, itemIndex) => itemIndex !== index);
}
