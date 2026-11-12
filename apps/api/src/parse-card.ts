export type SocialLink = { network: string; url: string };

export type ParsedCard = {
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
  socials: SocialLink[];
  confidence: Record<string, number>;
};

const TITLE = /(manager|director|engineer|officer|consultant|lead|head|president|founder|designer|analyst|specialist|coordinator|经理|总监|工程师|顾问|主管)/i;
const COMPANY = /(ltd|inc|llc|corp|company|co\.|gmbh|集团|公司|有限)/i;
const ADDRESS = /(street|st\.|road|rd\.|avenue|ave|suite|floor|区|路|街|号|市)/i;

export function parseCardText(text: string): ParsedCard {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const website = text.match(/https?:\/\/\S+|www\.\S+/i)?.[0] ?? "";
  const phones = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/g)?.map((item) => item.trim()) ?? [];
  const nameZh = lines.find((line) => /^[\u4e00-\u9fff]{2,6}$/.test(line)) ?? "";
  const nameEn = lines.find((line) => /^[A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){1,3}$/.test(line)) ?? "";
  const jobTitle = lines.find((line) => TITLE.test(line)) ?? "";
  const company = lines.find((line) => COMPANY.test(line)) ?? "";
  const address = lines.find((line) => ADDRESS.test(line)) ?? "";
  const socials: SocialLink[] = [];
  for (const network of ["linkedin", "wechat", "whatsapp", "twitter", "x.com", "facebook", "instagram", "youtube"]) {
    const hit = lines.find((line) => line.toLowerCase().includes(network));
    if (hit) socials.push({ network: network === "x.com" ? "x" : network, url: hit });
  }
  const used = new Set([nameZh, nameEn, jobTitle, company, address, email].filter(Boolean));
  const fallback = lines.find((line) => !used.has(line) && line.length < 40) ?? lines[0] ?? "";
  const fields: ParsedCard = {
    name: nameEn || nameZh || fallback,
    nameZh,
    nameEn,
    company,
    jobTitle,
    email,
    mobile: phones[0] ?? "",
    phone: phones[1] ?? "",
    website,
    address,
    socials,
    confidence: {},
  };
  fields.confidence = {
    name: fields.name ? (nameEn || nameZh ? 0.82 : 0.45) : 0,
    nameZh: nameZh ? 0.8 : 0,
    nameEn: nameEn ? 0.84 : 0,
    company: company ? 0.74 : 0,
    jobTitle: jobTitle ? 0.7 : 0,
    email: email ? 0.96 : 0,
    mobile: fields.mobile ? 0.8 : 0,
    phone: fields.phone ? 0.62 : 0,
    website: website ? 0.9 : 0,
    address: address ? 0.58 : 0,
  };
  return fields;
}

export function overallConfidence(fields: ParsedCard) {
  const values = Object.values(fields.confidence).filter((value) => value > 0);
  if (!values.length) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}
