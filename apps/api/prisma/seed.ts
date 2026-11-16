import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const workspaceName = process.env.SEED_WORKSPACE_NAME?.trim() || "Workspace";
  const slug = (process.env.SEED_WORKSPACE_SLUG?.trim() || "workspace").toLowerCase();
  if (!email || !password || password.length < 8) {
    console.log("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (8 or more characters) to create the first empty workspace. No cards are created.");
    return;
  }
  const existing = await prisma.workspace.findUnique({ where: { slug } });
  if (existing) {
    console.log(`Workspace ${slug} already exists. Seed left every record untouched.`);
    return;
  }
  const user = await prisma.user.create({
    data: { email, name: process.env.SEED_ADMIN_NAME?.trim() || "Administrator", passwordHash: await bcrypt.hash(password, 10) },
  });
  const workspace = await prisma.workspace.create({ data: { name: workspaceName, slug, plan: "TEAM" } });
  await prisma.membership.create({ data: { userId: user.id, workspaceId: workspace.id, role: "SUPER_ADMIN", title: "Administrator" } });
  console.log(`Created empty workspace ${slug} for ${email}. No cards, contacts, scans, or files were added.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
