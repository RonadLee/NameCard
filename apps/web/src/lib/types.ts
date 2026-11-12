export type SocialLink = { network: string; url: string };
export type CustomField = { label: string; value: string };

export type Card = {
  id: string;
  name: string;
  nameZh?: string | null;
  nameEn?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  company?: string | null;
  phone?: string | null;
  mobile?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  notes?: string | null;
  socials: SocialLink[];
  customFields: CustomField[];
  tags: string[];
  logoUrl?: string | null;
  photoUrl?: string | null;
  bannerUrl?: string | null;
  template: string;
  themeColor: string;
  font: string;
  qrSlug: string;
  visibility: "PRIVATE" | "TEAM" | "PUBLIC";
  status: "ACTIVE" | "ARCHIVED";
  ownerId: string;
  updatedAt: string;
  owner?: { id: string; name: string; email: string };
};

export type Contact = {
  id: string;
  name: string;
  nameZh?: string | null;
  nameEn?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  company?: string | null;
  phone?: string | null;
  mobile?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  notes?: string | null;
  socials: SocialLink[];
  tags: string[];
  groupName?: string | null;
  favorite: boolean;
  source: string;
  imageUrl?: string | null;
  cardImageUrl?: string | null;
  ownerId: string;
  updatedAt: string;
};

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  plan: "PERSONAL" | "TEAM";
  logoUrl?: string | null;
  storageUsedBytes: number;
  storageLimitBytes: number;
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  nameZh?: string | null;
  title?: string | null;
  mfaEnabled: boolean;
  feishuOpenId?: string | null;
  feishuUnionId?: string | null;
  memberships: { role: string; title?: string | null; department?: string | null; workspace: { id: string; name: string; slug: string; plan: string } }[];
};

export type Signature = {
  id: string;
  name: string;
  template: string;
  theme: string;
  showQr: boolean;
  showPhoto: boolean;
  showSocial: boolean;
  card: Card;
};

export type VirtualBackground = {
  id: string;
  name: string;
  jobTitle?: string | null;
  backgroundUrl?: string | null;
  accent: string;
  showQr: boolean;
  showLogo: boolean;
  showName: boolean;
  platform: string;
  createdAt: string;
  card?: Card | null;
};

export type ScanItem = {
  id: string;
  batchId: string;
  status: "REVIEW" | "SAVED" | "REJECTED";
  imageUrl?: string | null;
  fileName?: string | null;
  rawText: string;
  language: string;
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
    socials: SocialLink[];
    confidence: Record<string, number>;
  };
  confidence: number;
  sharpness?: number | null;
  rotation: number;
  duplicateOf?: string | null;
  engine?: string | null;
  note?: string | null;
};

export type AnalyticsReport = {
  days: number;
  totals: Record<string, number>;
  series: { date: string; view: number; share: number; scan: number; download: number; save: number; activity: number }[];
  heatmap: number[][];
  cards: { id: string; name: string; company?: string | null; events: number }[];
};
