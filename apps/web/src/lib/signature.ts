import type { Card, Signature } from "./types";

export function publicUrl(slug: string) {
  if (typeof window === "undefined") return `/c/${slug}`;
  return `${window.location.origin}/c/${slug}`;
}

export function signatureHtml(signature: Pick<Signature, "template" | "theme" | "showQr" | "showPhoto" | "showSocial">, card: Card) {
  const link = publicUrl(card.qrSlug);
  const color = signature.theme || card.themeColor || "#1aa3e8";
  const socials = signature.showSocial ? (card.socials || []).map((item) => `<a href="${item.url}" style="color:${color};margin-right:8px;text-decoration:none">${item.network}</a>`).join("") : "";
  const photo = signature.showPhoto && card.photoUrl ? `<img src="${card.photoUrl}" width="64" height="64" style="border-radius:50%;object-fit:cover" alt="">` : "";
  const qr = signature.showQr ? `<img alt="QR" width="72" height="72" src="https://api.qrserver.com/v1/create-qr-code/?size=144x144&data=${encodeURIComponent(link)}">` : "";
  if (signature.template === "compact") {
    return `<table cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;color:#1c1f23"><tr><td style="padding-right:12px;border-right:3px solid ${color}">${photo}</td><td style="padding-left:12px"><div style="font-weight:700">${card.name}</div><div style="color:#5c6570;font-size:13px">${card.jobTitle || ""} · ${card.company || ""}</div><div style="font-size:13px;margin-top:4px">${card.email || ""} ${card.mobile || ""}</div></td></tr></table>`;
  }
  if (signature.template === "banner") {
    return `<table cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;width:420px"><tr><td style="background:${color};color:white;padding:10px 14px;font-weight:700">${card.company || "NameCard"}</td></tr><tr><td style="padding:12px 14px"><div style="font-size:18px;font-weight:700">${card.name}</div><div>${card.jobTitle || ""}</div><div style="margin-top:6px;font-size:13px">${card.email || ""}<br>${card.mobile || ""}</div><div style="margin-top:8px">${socials}</div></td><td>${qr}</td></tr></table>`;
  }
  return `<table cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;color:#1c1f23"><tr><td style="padding-right:14px">${photo}</td><td><div style="font-size:16px;font-weight:700">${card.name}</div><div style="color:#5c6570">${card.jobTitle || ""}</div><div style="color:#5c6570">${card.company || ""}</div><div style="margin-top:6px;font-size:13px"><a href="mailto:${card.email || ""}" style="color:${color};text-decoration:none">${card.email || ""}</a><br>${card.mobile || card.phone || ""}<br><a href="${card.website || link}" style="color:${color}">${card.website || link}</a></div><div style="margin-top:6px">${socials}</div></td><td style="padding-left:12px">${qr}</td></tr></table>`;
}

export const mailClients = [
  { name: "Gmail", steps: "Open Gmail settings, scroll to Signature, create one, and paste with Ctrl+Shift+V so the formatting stays." },
  { name: "Outlook", steps: "File → Options → Mail → Signatures. Paste the signature into the editor, then set it as the default for new messages." },
  { name: "Apple Mail", steps: "Mail → Settings → Signatures. Paste into the selected signature. Uncheck “Always match my default message font” if the layout shifts." },
  { name: "Microsoft 365", steps: "Outlook on the web → Settings → Account → Signatures. Paste the HTML signature and save it for replies and new mail." },
];
