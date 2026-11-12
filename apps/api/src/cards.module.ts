import { BadRequestException, Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AnalyticsType, CardStatus, CardVisibility, Prisma } from "@prisma/client";
import { IsArray, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { AuthModule } from "./auth.module";
import { asJson, atLeast, AuditService, AuthGuard, AuthUser, CurrentUser, publicId, Roles, RolesGuard } from "./common";
import { PrismaService } from "./prisma.service";

const TEMPLATES = ["classic", "split", "banner"];
const FONTS = ["Inter", "Georgia", "Trebuchet MS"];

export class CardDto {
  @IsString()
  @MinLength(1)
  name: string;

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
  @IsOptional() @IsArray() socials?: { network: string; url: string }[];
  @IsOptional() @IsArray() customFields?: { label: string; value: string }[];
  @IsOptional() @IsArray() tags?: string[];
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() photoUrl?: string;
  @IsOptional() @IsString() bannerUrl?: string;
  @IsOptional() @IsIn(TEMPLATES) template?: string;
  @IsOptional() @IsString() themeColor?: string;
  @IsOptional() @IsIn(FONTS) font?: string;
  @IsOptional() @IsIn(["PRIVATE", "TEAM", "PUBLIC"]) visibility?: CardVisibility;
}

function dataOf(dto: Partial<CardDto>): Prisma.CardUpdateInput {
  const data: Prisma.CardUpdateInput = {};
  const fields = ["name", "nameZh", "nameEn", "jobTitle", "department", "company", "phone", "mobile", "whatsapp", "email", "website", "address", "notes", "logoUrl", "photoUrl", "bannerUrl", "template", "themeColor", "font", "visibility"] as const;
  for (const field of fields) {
    if (dto[field] !== undefined) (data as Record<string, unknown>)[field] = dto[field];
  }
  if (dto.socials) data.socials = asJson(dto.socials);
  if (dto.customFields) data.customFields = asJson(dto.customFields);
  if (dto.tags) data.tags = dto.tags.map((tag) => tag.trim()).filter(Boolean);
  return data;
}

@Injectable()
export class CardsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  list(user: AuthUser, archived?: string) {
    return this.prisma.card.findMany({
      where: {
        workspaceId: user.wid,
        ownerId: user.sub,
        status: archived === "1" ? CardStatus.ARCHIVED : CardStatus.ACTIVE,
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async get(user: AuthUser, id: string) {
    const card = await this.owned(user, id);
    return card;
  }

  async create(user: AuthUser, dto: CardDto) {
    const card = await this.prisma.card.create({
      data: {
        ...(dataOf(dto) as Prisma.CardCreateInput),
        name: dto.name,
        qrSlug: publicId(),
        workspace: { connect: { id: user.wid } },
        owner: { connect: { id: user.sub } },
      },
    });
    await this.audit.log(user, "card.create", "card", card.id, { name: card.name });
    await this.track(user.wid, "ACTIVITY", card.id);
    return card;
  }

  async update(user: AuthUser, id: string, dto: Partial<CardDto>) {
    await this.owned(user, id, true);
    const card = await this.prisma.card.update({ where: { id }, data: dataOf(dto) });
    await this.audit.log(user, "card.update", "card", id);
    return card;
  }

  async remove(user: AuthUser, id: string) {
    await this.owned(user, id, true);
    await this.prisma.card.delete({ where: { id } });
    await this.audit.log(user, "card.delete", "card", id);
    return { ok: true };
  }

  async duplicate(user: AuthUser, id: string) {
    const card = await this.owned(user, id);
    const copy = await this.prisma.card.create({
      data: {
        workspaceId: user.wid,
        ownerId: user.sub,
        name: `${card.name} copy`,
        nameZh: card.nameZh,
        nameEn: card.nameEn,
        jobTitle: card.jobTitle,
        department: card.department,
        company: card.company,
        phone: card.phone,
        mobile: card.mobile,
        whatsapp: card.whatsapp,
        email: card.email,
        website: card.website,
        address: card.address,
        notes: card.notes,
        socials: card.socials as Prisma.InputJsonValue,
        customFields: card.customFields as Prisma.InputJsonValue,
        tags: card.tags,
        logoUrl: card.logoUrl,
        photoUrl: card.photoUrl,
        bannerUrl: card.bannerUrl,
        template: card.template,
        themeColor: card.themeColor,
        font: card.font,
        qrSlug: publicId(),
      },
    });
    await this.audit.log(user, "card.duplicate", "card", copy.id, { from: id });
    return copy;
  }

  async archive(user: AuthUser, id: string) {
    const card = await this.owned(user, id, true);
    const next = card.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED";
    const updated = await this.prisma.card.update({
      where: { id },
      data: { status: next, archivedAt: next === "ARCHIVED" ? new Date() : null },
    });
    await this.audit.log(user, "card.archive", "card", id, { status: next });
    return updated;
  }

  async share(user: AuthUser, id: string, channel: string) {
    const card = await this.owned(user, id);
    await this.prisma.shareEvent.create({ data: { cardId: id, channel } });
    await this.track(user.wid, "SHARE", id);
    await this.audit.log(user, "card.share", "card", id, { channel });
    return { slug: card.qrSlug, channel };
  }

  async requestPublish(user: AuthUser, id: string) {
    const card = await this.owned(user, id, true);
    const approval = await this.prisma.approvalRequest.create({
      data: {
        workspaceId: user.wid,
        requesterId: user.sub,
        type: "card.publish",
        payload: asJson({ cardId: card.id, name: card.name }),
      },
    });
    await this.audit.log(user, "card.publish_requested", "approval", approval.id);
    return approval;
  }

  async pdf(user: AuthUser, id: string) {
    const card = await this.owned(user, id);
    await this.track(user.wid, "DOWNLOAD", id);
    return this.renderPdf(card);
  }

  async publicCard(slug: string) {
    const card = await this.prisma.card.findFirst({ where: { qrSlug: slug, status: "ACTIVE", visibility: "PUBLIC" } });
    if (!card) throw new NotFoundException("This card is not public");
    await this.track(card.workspaceId, "VIEW", card.id);
    await this.track(card.workspaceId, "SCAN", card.id);
    return card;
  }

  async publicPdf(slug: string) {
    const card = await this.publicCard(slug);
    await this.track(card.workspaceId, "DOWNLOAD", card.id);
    return this.renderPdf(card);
  }

  shared(user: AuthUser) {
    return this.prisma.card.findMany({
      where: { workspaceId: user.wid, status: "ACTIVE", visibility: { in: ["TEAM", "PUBLIC"] } },
      include: { owner: { select: { id: true, name: true, email: true } } },
      orderBy: { updatedAt: "desc" },
    });
  }

  private async owned(user: AuthUser, id: string, write = false) {
    const card = await this.prisma.card.findFirst({ where: { id, workspaceId: user.wid } });
    if (!card) throw new NotFoundException("Card not found");
    if (write && !atLeast(user.role, "MANAGER") && card.ownerId !== user.sub) {
      throw new BadRequestException("You can only change your own cards");
    }
    return card;
  }

  private track(workspaceId: string, type: AnalyticsType, cardId?: string) {
    return this.prisma.analyticsEvent.create({ data: { workspaceId, type, cardId } });
  }

  private async renderPdf(card: { name: string; jobTitle: string | null; company: string | null; email: string | null; mobile: string | null; phone: string | null; website: string | null; address: string | null; qrSlug: string }) {
    const doc = await PDFDocument.create();
    const page = doc.addPage([540, 320]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    page.drawRectangle({ x: 0, y: 0, width: 540, height: 320, color: rgb(0.96, 0.97, 0.98) });
    page.drawRectangle({ x: 0, y: 0, width: 12, height: 320, color: rgb(0.1, 0.64, 0.91) });
    page.drawText(card.company || "NameCard", { x: 36, y: 250, size: 12, font, color: rgb(0.4, 0.45, 0.5) });
    page.drawText(card.name, { x: 36, y: 214, size: 28, font: bold, color: rgb(0.11, 0.12, 0.14) });
    page.drawText(card.jobTitle || "", { x: 36, y: 186, size: 14, font, color: rgb(0.25, 0.3, 0.35) });
    const lines = [card.mobile, card.phone, card.email, card.website, card.address].filter(Boolean) as string[];
    lines.forEach((line, index) => page.drawText(line, { x: 36, y: 140 - index * 22, size: 12, font, color: rgb(0.2, 0.24, 0.28) }));
    page.drawText(`namecard.app/c/${card.qrSlug}`, { x: 36, y: 28, size: 10, font, color: rgb(0.45, 0.5, 0.55) });
    return Buffer.from(await doc.save());
  }
}

@Controller("cards")
@UseGuards(AuthGuard, RolesGuard)
export class CardsController {
  constructor(private cards: CardsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("archived") archived?: string) {
    return this.cards.list(user, archived);
  }

  @Get("shared")
  shared(@CurrentUser() user: AuthUser) {
    return this.cards.shared(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CardDto) {
    return this.cards.create(user, dto);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.cards.get(user, id);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CardDto) {
    return this.cards.update(user, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.cards.remove(user, id);
  }

  @Post(":id/duplicate")
  duplicate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.cards.duplicate(user, id);
  }

  @Post(":id/archive")
  archive(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.cards.archive(user, id);
  }

  @Post(":id/share")
  share(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: { channel?: string }) {
    return this.cards.share(user, id, body.channel || "link");
  }

  @Post(":id/publish-request")
  @Roles("USER")
  publish(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.cards.requestPublish(user, id);
  }

  @Get(":id/pdf")
  async pdf(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const bytes = await this.cards.pdf(user, id);
    return { filename: "card.pdf", base64: bytes.toString("base64") };
  }
}

@Controller("public/cards")
export class PublicCardsController {
  constructor(private cards: CardsService) {}

  @Get(":slug")
  get(@Param("slug") slug: string) {
    return this.cards.publicCard(slug);
  }

  @Get(":slug/pdf")
  async pdf(@Param("slug") slug: string) {
    const bytes = await this.cards.publicPdf(slug);
    return { filename: "card.pdf", base64: bytes.toString("base64") };
  }
}

@Module({
  imports: [AuthModule],
  controllers: [CardsController, PublicCardsController],
  providers: [CardsService],
  exports: [CardsService],
})
export class CardsModule {}
