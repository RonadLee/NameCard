import { BadRequestException, Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Prisma } from "@prisma/client";
import { IsArray, IsBoolean, IsOptional, IsString } from "class-validator";
import ExcelJS from "exceljs";
import type { Response } from "express";
import { AuthModule } from "./auth.module";
import { asJson, atLeast, AuditService, AuthGuard, AuthUser, CurrentUser } from "./common";
import { PrismaService } from "./prisma.service";

const COLUMNS = ["name", "nameZh", "nameEn", "jobTitle", "department", "company", "phone", "mobile", "whatsapp", "email", "website", "address", "notes", "tags", "groupName", "favorite"] as const;

class ContactDto {
  @IsString() name: string;
  @IsOptional() @IsString() nameZh?: string;
  @IsOptional() @IsString() nameEn?: string;
  @IsOptional() @IsString() jobTitle?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() mobile?: string;
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsArray() tags?: string[];
  @IsOptional() @IsString() groupName?: string;
  @IsOptional() @IsBoolean() favorite?: boolean;
  @IsOptional() @IsArray() socials?: { network: string; url: string }[];
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() cardImageUrl?: string;
}

class MergeDto {
  @IsString() keepId: string;
  @IsArray() dropIds: string[];
}

class SharedCardDto {
  @IsString() slug: string;
}

class GroupNameDto {
  @IsString() name: string;
}

class RenameGroupDto {
  @IsString() from: string;
  @IsString() to: string;
}

class IdsDto {
  @IsArray() ids: string[];
  @IsOptional() @IsString() groupName?: string;
}

type ContactQuery = { q?: string; tag?: string; group?: string; favorite?: string; sort?: string; scope?: string; page?: string; pageSize?: string };

function clean(dto: Partial<ContactDto>): Prisma.ContactUpdateInput {
  const data: Record<string, unknown> = {};
  for (const key of ["name", "nameZh", "nameEn", "jobTitle", "department", "company", "phone", "mobile", "whatsapp", "email", "website", "address", "notes", "groupName", "favorite", "source", "imageUrl", "cardImageUrl"] as const) {
    if (dto[key] !== undefined) data[key] = dto[key];
  }
  if (dto.tags) data.tags = dto.tags.map((tag) => tag.trim()).filter(Boolean);
  if (dto.socials) data.socials = asJson(dto.socials);
  return data;
}

@Injectable()
export class ContactsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async list(user: AuthUser, query: ContactQuery) {
    const where = this.where(user, query);
    const orderBy = query.sort === "name" ? { name: "asc" as const } : query.sort === "company" ? { company: "asc" as const } : query.sort === "created" ? { createdAt: "desc" as const } : { updatedAt: "desc" as const };
    if (!query.page) return this.prisma.contact.findMany({ where, orderBy });
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 59));
    const [items, total] = await Promise.all([
      this.prisma.contact.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.contact.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async groups(user: AuthUser, scope?: string) {
    const ownerId = scope === "mine" ? user.sub : undefined;
    const [workspace, counts] = await Promise.all([
      this.prisma.workspace.findUnique({ where: { id: user.wid } }),
      this.prisma.contact.groupBy({ by: ["groupName"], where: { workspaceId: user.wid, ownerId }, _count: true }),
    ]);
    const saved = workspace?.contactGroups ?? [];
    const names = Array.from(new Set([...saved, ...counts.map((row) => row.groupName).filter((name): name is string => Boolean(name))])).sort((a, b) => a.localeCompare(b));
    return {
      all: counts.reduce((sum, row) => sum + row._count, 0),
      ungrouped: counts.find((row) => !row.groupName)?._count ?? 0,
      groups: names.map((name) => ({ name, count: counts.find((row) => row.groupName === name)?._count ?? 0 })),
    };
  }

  async createGroup(user: AuthUser, name: string) {
    const cleanName = name.trim();
    if (!cleanName) throw new BadRequestException("Group name is required");
    const workspace = await this.prisma.workspace.findUnique({ where: { id: user.wid } });
    const names = workspace?.contactGroups ?? [];
    if (names.some((item) => item.toLowerCase() === cleanName.toLowerCase())) throw new BadRequestException("That group already exists");
    await this.prisma.workspace.update({ where: { id: user.wid }, data: { contactGroups: [...names, cleanName] } });
    await this.audit.log(user, "contact.group_create", "workspace", user.wid, { name: cleanName });
    return { name: cleanName };
  }

  async renameGroup(user: AuthUser, from: string, to: string) {
    const next = to.trim();
    if (!next) throw new BadRequestException("Group name is required");
    const workspace = await this.prisma.workspace.findUnique({ where: { id: user.wid } });
    const used = await this.prisma.contact.findFirst({ where: { workspaceId: user.wid, groupName: from } });
    const names = workspace?.contactGroups ?? [];
    if (!names.includes(from) && !used) throw new NotFoundException("Group not found");
    const contactGroups = Array.from(new Set([...names.filter((name) => name !== from), next]));
    await this.prisma.workspace.update({ where: { id: user.wid }, data: { contactGroups } });
    await this.prisma.contact.updateMany({ where: { workspaceId: user.wid, groupName: from }, data: { groupName: next } });
    await this.audit.log(user, "contact.group_rename", "workspace", user.wid, { from, to: next });
    return { name: next };
  }

  async deleteGroup(user: AuthUser, name: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: user.wid } });
    const names = workspace?.contactGroups ?? [];
    await this.prisma.workspace.update({ where: { id: user.wid }, data: { contactGroups: names.filter((item) => item !== name) } });
    await this.prisma.contact.updateMany({ where: { workspaceId: user.wid, groupName: name }, data: { groupName: null } });
    await this.audit.log(user, "contact.group_delete", "workspace", user.wid, { name });
    return { ok: true };
  }

  async categorize(user: AuthUser, ids: string[], groupName: string) {
    const name = groupName.trim();
    if (!name) throw new BadRequestException("Choose a group");
    await this.readable(user, ids);
    const workspace = await this.prisma.workspace.findUnique({ where: { id: user.wid } });
    const names = workspace?.contactGroups ?? [];
    if (!names.includes(name)) await this.prisma.workspace.update({ where: { id: user.wid }, data: { contactGroups: [...names, name] } });
    await this.prisma.contact.updateMany({ where: { id: { in: ids }, workspaceId: user.wid }, data: { groupName: name } });
    await this.audit.log(user, "contact.categorize", "contact", undefined, { count: ids.length, groupName: name });
    return { ok: true };
  }

  async removeMany(user: AuthUser, ids: string[]) {
    await this.readable(user, ids);
    await this.prisma.contact.deleteMany({ where: { id: { in: ids }, workspaceId: user.wid } });
    await this.audit.log(user, "contact.delete_many", "contact", undefined, { count: ids.length });
    return { ok: true };
  }

  async create(user: AuthUser, dto: ContactDto) {
    if (dto.groupName?.trim()) await this.rememberGroup(user, dto.groupName.trim());
    const row = await this.prisma.contact.create({
      data: { ...(clean(dto) as Prisma.ContactCreateInput), name: dto.name, workspace: { connect: { id: user.wid } }, owner: { connect: { id: user.sub } } },
    });
    await this.audit.log(user, "contact.create", "contact", row.id);
    await this.prisma.analyticsEvent.create({ data: { workspaceId: user.wid, type: "SAVE" } });
    return row;
  }

  async update(user: AuthUser, id: string, dto: Partial<ContactDto>) {
    const row = await this.must(user, id);
    if (!atLeast(user.role, "MANAGER") && row.ownerId !== user.sub) throw new BadRequestException("You can only edit contacts you created");
    const updated = await this.prisma.contact.update({ where: { id }, data: clean(dto) });
    await this.audit.log(user, "contact.update", "contact", id);
    return updated;
  }

  async remove(user: AuthUser, id: string) {
    const row = await this.must(user, id);
    if (!atLeast(user.role, "MANAGER") && row.ownerId !== user.sub) throw new BadRequestException("You can only delete contacts you created");
    await this.prisma.contact.delete({ where: { id } });
    await this.audit.log(user, "contact.delete", "contact", id);
    return { ok: true };
  }

  async saveSharedCard(user: AuthUser, slug: string) {
    const card = await this.prisma.card.findFirst({
      where: {
        qrSlug: slug,
        status: "ACTIVE",
        OR: [{ visibility: "PUBLIC" }, { visibility: "TEAM", workspaceId: user.wid }],
      },
    });
    if (!card) throw new NotFoundException("That card is not available to save");
    const email = card.email?.trim();
    const existing = email
      ? await this.prisma.contact.findFirst({ where: { workspaceId: user.wid, email: { equals: email, mode: "insensitive" } } })
      : await this.prisma.contact.findFirst({ where: { workspaceId: user.wid, name: card.name, company: card.company } });
    if (existing) return { ...existing, alreadySaved: true };
    const created = await this.create(user, {
      name: card.name,
      nameZh: card.nameZh ?? "",
      nameEn: card.nameEn ?? "",
      jobTitle: card.jobTitle ?? "",
      department: card.department ?? "",
      company: card.company ?? "",
      phone: card.phone ?? "",
      mobile: card.mobile ?? "",
      whatsapp: card.whatsapp ?? "",
      email: card.email ?? "",
      website: card.website ?? "",
      address: card.address ?? "",
      notes: card.notes ?? "",
      tags: ["Shared"],
      source: "qr",
      socials: Array.isArray(card.socials) ? (card.socials as { network: string; url: string }[]) : [],
    });
    await this.prisma.analyticsEvent.create({ data: { workspaceId: card.workspaceId, type: "SCAN", cardId: card.id } });
    return { ...created, alreadySaved: false };
  }

  async merge(user: AuthUser, keepId: string, dropIds: string[]) {
    if (!atLeast(user.role, "MANAGER")) throw new BadRequestException("Managers merge duplicate contacts");
    const keep = await this.must(user, keepId);
    const drops = await this.prisma.contact.findMany({ where: { id: { in: dropIds }, workspaceId: user.wid } });
    const patch: Record<string, unknown> = {};
    for (const field of ["nameZh", "nameEn", "jobTitle", "department", "company", "phone", "mobile", "whatsapp", "email", "website", "address", "notes", "groupName", "imageUrl", "cardImageUrl"] as const) {
      if (!keep[field]) {
        const value = drops.map((row) => row[field]).find(Boolean);
        if (value) patch[field] = value;
      }
    }
    patch.tags = Array.from(new Set([keep.tags, ...drops.map((row) => row.tags)].flat()));
    patch.favorite = keep.favorite || drops.some((row) => row.favorite);
    const updated = await this.prisma.contact.update({ where: { id: keepId }, data: patch });
    await this.prisma.contact.deleteMany({ where: { id: { in: drops.map((row) => row.id) } } });
    await this.audit.log(user, "contact.merge", "contact", keepId, { dropped: drops.map((row) => row.id) });
    return updated;
  }

  async importFile(user: AuthUser, file: Express.Multer.File) {
    const name = file.originalname.toLowerCase();
    let rows: Record<string, string>[] = [];
    if (name.endsWith(".xlsx")) rows = await this.fromXlsx(file.buffer);
    else if (name.endsWith(".vcf")) rows = this.fromVcard(file.buffer.toString("utf8"));
    else rows = this.fromCsv(file.buffer.toString("utf8"));
    let created = 0;
    for (const row of rows) {
      if (!row.name) continue;
      await this.prisma.contact.create({
        data: {
          workspaceId: user.wid,
          ownerId: user.sub,
          name: row.name,
          nameZh: row.nameZh || null,
          nameEn: row.nameEn || null,
          jobTitle: row.jobTitle || null,
          department: row.department || null,
          company: row.company || null,
          phone: row.phone || null,
          mobile: row.mobile || null,
          whatsapp: row.whatsapp || null,
          email: row.email || null,
          website: row.website || null,
          address: row.address || null,
          notes: row.notes || null,
          groupName: row.groupName || null,
          favorite: row.favorite === "true" || row.favorite === "1",
          tags: (row.tags || "").split(/[|,]/).map((tag) => tag.trim()).filter(Boolean),
          source: "import",
        },
      });
      created += 1;
    }
    await this.audit.log(user, "contact.import", "contact", undefined, { created, file: file.originalname });
    return { created };
  }

  async export(user: AuthUser, format: string, res: Response, query: ContactQuery = {}) {
    const rows = await this.prisma.contact.findMany({ where: this.where(user, query), orderBy: { name: "asc" } });
    if (format === "xlsx") {
      const book = new ExcelJS.Workbook();
      const sheet = book.addWorksheet("Contacts");
      sheet.addRow([...COLUMNS]);
      for (const row of rows) sheet.addRow(COLUMNS.map((key) => (key === "tags" ? row.tags.join("|") : String(row[key] ?? ""))));
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=contacts.xlsx");
      await book.xlsx.write(res);
      return;
    }
    if (format === "vcf") {
      const body = rows.map((row) => ["BEGIN:VCARD", "VERSION:3.0", `FN:${row.name}`, `N:${row.name}`, row.company ? `ORG:${row.company}` : "", row.jobTitle ? `TITLE:${row.jobTitle}` : "", row.email ? `EMAIL:${row.email}` : "", row.mobile ? `TEL;TYPE=CELL:${row.mobile}` : "", row.phone ? `TEL;TYPE=WORK:${row.phone}` : "", row.address ? `ADR:${row.address}` : "", row.website ? `URL:${row.website}` : "", "END:VCARD"].filter(Boolean).join("\r\n")).join("\r\n");
      res.setHeader("Content-Type", "text/vcard");
      res.setHeader("Content-Disposition", "attachment; filename=contacts.vcf");
      res.send(body);
      return;
    }
    const header = COLUMNS.join(",");
    const lines = rows.map((row) => COLUMNS.map((key) => csv(key === "tags" ? row.tags.join("|") : String(row[key] ?? ""))).join(","));
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=contacts.csv");
    res.send([header, ...lines].join("\n"));
  }

  private where(user: AuthUser, query: ContactQuery): Prisma.ContactWhereInput {
    const q = query.q?.trim();
    return {
      workspaceId: user.wid,
      ownerId: query.scope === "mine" ? user.sub : undefined,
      favorite: query.favorite === "1" ? true : undefined,
      groupName: query.group === "-" ? null : query.group || undefined,
      tags: query.tag ? { has: query.tag } : undefined,
      OR: q
        ? [
            { name: { contains: q, mode: "insensitive" } },
            { nameZh: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { mobile: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { jobTitle: { contains: q, mode: "insensitive" } },
            { address: { contains: q, mode: "insensitive" } },
          ]
        : undefined,
    };
  }

  private async rememberGroup(user: AuthUser, name: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: user.wid } });
    const names = workspace?.contactGroups ?? [];
    if (names.some((item) => item.toLowerCase() === name.toLowerCase())) return;
    await this.prisma.workspace.update({ where: { id: user.wid }, data: { contactGroups: [...names, name] } });
  }

  private async readable(user: AuthUser, ids: string[]) {
    if (!ids.length) throw new BadRequestException("Select at least one card");
    const rows = await this.prisma.contact.findMany({ where: { id: { in: ids }, workspaceId: user.wid } });
    if (rows.length !== new Set(ids).size) throw new NotFoundException("Card not found");
    if (!atLeast(user.role, "MANAGER") && rows.some((row) => row.ownerId !== user.sub)) {
      throw new BadRequestException("You can only change cards you saved");
    }
  }

  private async must(user: AuthUser, id: string) {
    const row = await this.prisma.contact.findFirst({ where: { id, workspaceId: user.wid } });
    if (!row) throw new NotFoundException("Contact not found");
    return row;
  }

  private fromCsv(text: string) {
    const [header, ...lines] = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
    const keys = header.split(",").map((key) => key.trim());
    return lines.map((line) => {
      const cells = splitCsv(line);
      return Object.fromEntries(keys.map((key, index) => [key, cells[index] ?? ""]));
    });
  }

  private async fromXlsx(buffer: Buffer) {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = book.worksheets[0];
    const keys = (sheet.getRow(1).values as Array<string | undefined>).slice(1).map((key) => String(key ?? ""));
    const rows: Record<string, string>[] = [];
    sheet.eachRow((row, index) => {
      if (index === 1) return;
      const values = row.values as Array<unknown>;
      rows.push(Object.fromEntries(keys.map((key, cell) => [key, String(values[cell + 1] ?? "")])));
    });
    return rows;
  }

  private fromVcard(text: string) {
    return text.split(/BEGIN:VCARD/i).slice(1).map((block) => {
      const line = (name: string) => block.match(new RegExp(`^${name}[^:]*:(.*)$`, "im"))?.[1]?.trim() ?? "";
      return { name: line("FN") || line("N"), company: line("ORG"), jobTitle: line("TITLE"), email: line("EMAIL"), mobile: line("TEL"), address: line("ADR"), website: line("URL"), notes: line("NOTE") };
    });
  }
}

function csv(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function splitCsv(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else current += char;
  }
  cells.push(current);
  return cells;
}

@Controller("contacts")
@UseGuards(AuthGuard)
export class ContactsController {
  constructor(private contacts: ContactsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("q") q?: string, @Query("tag") tag?: string, @Query("group") group?: string, @Query("favorite") favorite?: string, @Query("sort") sort?: string, @Query("scope") scope?: string, @Query("page") page?: string, @Query("pageSize") pageSize?: string) {
    return this.contacts.list(user, { q, tag, group, favorite, sort, scope, page, pageSize });
  }

  @Get("groups")
  groups(@CurrentUser() user: AuthUser, @Query("scope") scope?: string) {
    return this.contacts.groups(user, scope);
  }

  @Post("groups")
  createGroup(@CurrentUser() user: AuthUser, @Body() dto: GroupNameDto) {
    return this.contacts.createGroup(user, dto.name);
  }

  @Patch("groups")
  renameGroup(@CurrentUser() user: AuthUser, @Body() dto: RenameGroupDto) {
    return this.contacts.renameGroup(user, dto.from, dto.to);
  }

  @Delete("groups")
  deleteGroup(@CurrentUser() user: AuthUser, @Query("name") name: string) {
    return this.contacts.deleteGroup(user, name);
  }

  @Post("categorize")
  categorize(@CurrentUser() user: AuthUser, @Body() dto: IdsDto) {
    return this.contacts.categorize(user, dto.ids, dto.groupName || "");
  }

  @Post("remove")
  removeMany(@CurrentUser() user: AuthUser, @Body() dto: IdsDto) {
    return this.contacts.removeMany(user, dto.ids);
  }

  @Get("export")
  export(@CurrentUser() user: AuthUser, @Query("format") format: string, @Query("group") group: string, @Query("scope") scope: string, @Query("q") q: string, @Res() res: Response) {
    return this.contacts.export(user, format || "csv", res, { group, scope, q });
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: ContactDto) {
    return this.contacts.create(user, dto);
  }

  @Post("import")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 12 * 1024 * 1024 } }))
  import(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("Choose a CSV, XLSX, or vCard file");
    return this.contacts.importFile(user, file);
  }

  @Post("merge")
  merge(@CurrentUser() user: AuthUser, @Body() dto: MergeDto) {
    return this.contacts.merge(user, dto.keepId, dto.dropIds);
  }

  @Post("from-card")
  fromCard(@CurrentUser() user: AuthUser, @Body() dto: SharedCardDto) {
    return this.contacts.saveSharedCard(user, dto.slug.trim());
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: ContactDto) {
    return this.contacts.update(user, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.contacts.remove(user, id);
  }
}

@Module({ imports: [AuthModule], controllers: [ContactsController], providers: [ContactsService] })
export class ContactsModule {}
