import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const password = "Northwind#2026";

async function main() {
  await prisma.workspace.deleteMany({ where: { slug: { in: ["northwind", "harbor"] } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@northwind.example" } } });

  const hash = await bcrypt.hash(password, 10);
  const alex = await prisma.user.create({
    data: { email: "alex.chen@northwind.example", name: "Alex Chen", nameZh: "陈艾力", title: "Marketing Manager", phone: "+1 415 555 0108", passwordHash: hash },
  });
  const mina = await prisma.user.create({
    data: { email: "mina.patel@northwind.example", name: "Mina Patel", title: "Enterprise Lead", passwordHash: hash },
  });
  const sam = await prisma.user.create({
    data: { email: "sam.lee@northwind.example", name: "Sam Lee", title: "Account Executive", passwordHash: hash },
  });

  const workspace = await prisma.workspace.create({
    data: { name: "Northwind", slug: "northwind", plan: "PERSONAL", logoUrl: "/brand/northwind.svg", storageUsedBytes: 18_000_000 },
  });
  const commercial = await prisma.department.create({ data: { workspaceId: workspace.id, name: "Commercial", feishuDepartmentId: "od-commercial" } });
  const engineering = await prisma.department.create({
    data: { workspaceId: workspace.id, name: "Engineering", parentId: commercial.id, feishuDepartmentId: "od-engineering" },
  });
  const sales = await prisma.team.create({ data: { workspaceId: workspace.id, name: "Enterprise Sales", departmentId: commercial.id } });
  await prisma.team.create({ data: { workspaceId: workspace.id, name: "Delivery", departmentId: engineering.id } });

  const members: { userId: string; role: Role; departmentId?: string; title: string }[] = [
    { userId: alex.id, role: "SUPER_ADMIN", departmentId: commercial.id, title: "Marketing Manager" },
    { userId: mina.id, role: "MANAGER", departmentId: commercial.id, title: "Enterprise Lead" },
    { userId: sam.id, role: "USER", departmentId: commercial.id, title: "Account Executive" },
  ];
  for (const member of members) {
    await prisma.membership.create({ data: { ...member, workspaceId: workspace.id } });
  }
  await prisma.teamMember.createMany({ data: [alex, mina, sam].map((user) => ({ teamId: sales.id, userId: user.id })) });

  const harbor = await prisma.workspace.create({ data: { name: "Harbor Advisory", slug: "harbor", plan: "TEAM" } });
  await prisma.membership.create({ data: { userId: alex.id, workspaceId: harbor.id, role: "ADMIN", title: "Advisor" } });

  const alexCard = await prisma.card.create({
    data: {
      workspaceId: workspace.id,
      ownerId: alex.id,
      name: "Alex Chen",
      nameZh: "陈艾力",
      nameEn: "Alex Chen",
      jobTitle: "Marketing Manager",
      department: "Commercial",
      company: "Northwind Energy",
      phone: "+1 415 555 0100",
      mobile: "+1 415 555 0148",
      whatsapp: "+1 415 555 0148",
      email: "alex.chen@northwind.example",
      website: "https://northwind.example",
      address: "500 Market Street, San Francisco, CA",
      notes: "Primary outward-facing card for the commercial team.",
      socials: [
        { network: "linkedin", url: "https://www.linkedin.com/in/alex-chen" },
        { network: "youtube", url: "https://youtube.com/@northwind" },
      ],
      customFields: [{ label: "WeChat", value: "northwind-alex" }],
      tags: ["Primary"],
      logoUrl: "/brand/northwind.svg",
      template: "classic",
      themeColor: "#1aa3e8",
      font: "Inter",
      qrSlug: "alexchen",
      visibility: "PUBLIC",
    },
  });
  await prisma.card.create({
    data: {
      workspaceId: workspace.id,
      ownerId: mina.id,
      name: "Mina Patel",
      nameEn: "Mina Patel",
      jobTitle: "Enterprise Lead",
      company: "Northwind Energy",
      email: "mina.patel@northwind.example",
      mobile: "+1 415 555 0172",
      logoUrl: "/brand/northwind.svg",
      template: "split",
      themeColor: "#e85d4c",
      qrSlug: "minapatel",
      visibility: "TEAM",
      tags: ["Team"],
    },
  });

  const contacts = [
    ["Helena Ortiz", "Harbor & Co.", "Procurement Director", "helena@harbor.co", "+1 212 555 0191", "Client"],
    ["Kenji Sato", "Sato Robotics", "Founder", "kenji@sato.jp", "+81 3 5550 2211", "Partner"],
    ["Priya Nair", "Northline Clinic", "Operations Lead", "priya@northline.med", "+1 617 555 0133", "Client"],
    ["Wei Zhang", "Lumen Studio", "Design Director", "wei@lumen.studio", "+86 21 5555 0188", "Partner"],
    ["Jonas Berg", "Fjord Schools", "Principal", "jonas@fjord.edu", "+47 21 55 01 20", "Education"],
    ["Amelia Brooks", "Fieldnote NGO", "Program Manager", "amelia@fieldnote.org", "+44 20 7946 0991", "NGO"],
    ["Diego Alvarez", "Cinder Civil", "Project Engineer", "diego@cinder.engineering", "+34 91 555 0144", "Project"],
    ["Hana Kim", "Seoul Grid", "Account Director", "hana@seoulgrid.kr", "+82 2 555 0177", "Client"],
  ];
  for (const [name, company, jobTitle, email, mobile, tag] of contacts) {
    await prisma.contact.create({
      data: {
        workspaceId: workspace.id,
        ownerId: alex.id,
        name,
        nameEn: name,
        company,
        jobTitle,
        email,
        mobile,
        tags: [tag],
        groupName: tag,
        favorite: tag === "Client",
        source: "import",
        address: "See company record",
      },
    });
  }

  const now = Date.now();
  const types = ["VIEW", "SHARE", "SCAN", "DOWNLOAD", "SAVE", "ACTIVITY"] as const;
  for (let day = 0; day < 30; day += 1) {
    for (const type of types) {
      const count = 1 + ((day + type.length) % 4);
      for (let n = 0; n < count; n += 1) {
        await prisma.analyticsEvent.create({
          data: {
            workspaceId: workspace.id,
            cardId: type === "ACTIVITY" ? undefined : alexCard.id,
            type,
            createdAt: new Date(now - day * 86400000 - n * 3600000),
          },
        });
      }
    }
  }

  await prisma.auditLog.create({
    data: { workspaceId: workspace.id, actorId: alex.id, action: "workspace.seed", entity: "workspace", entityId: workspace.id, meta: { source: "seed" } },
  });
  console.log(`Seeded Northwind. Sign in as alex.chen@northwind.example / ${password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
