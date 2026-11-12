import { Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { AuthModule } from "./auth.module";
import { AuditService, AuthGuard, AuthUser, CurrentUser } from "./common";
import { PrismaService } from "./prisma.service";

class SignatureDto {
  @IsString() cardId: string;
  @IsString() name: string;
  @IsOptional() @IsString() template?: string;
  @IsOptional() @IsString() theme?: string;
  @IsOptional() @IsBoolean() showQr?: boolean;
  @IsOptional() @IsBoolean() showPhoto?: boolean;
  @IsOptional() @IsBoolean() showSocial?: boolean;
}

class BackgroundDto {
  @IsString() name: string;
  @IsOptional() @IsString() cardId?: string;
  @IsOptional() @IsString() jobTitle?: string;
  @IsOptional() @IsString() backgroundUrl?: string;
  @IsOptional() @IsString() accent?: string;
  @IsOptional() @IsBoolean() showQr?: boolean;
  @IsOptional() @IsBoolean() showLogo?: boolean;
  @IsOptional() @IsBoolean() showName?: boolean;
  @IsOptional() @IsString() platform?: string;
}

@Injectable()
export class StudioService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  signatures(user: AuthUser) {
    return this.prisma.signature.findMany({ where: { workspaceId: user.wid }, include: { card: true }, orderBy: { updatedAt: "desc" } });
  }

  async saveSignature(user: AuthUser, dto: SignatureDto, id?: string) {
    const card = await this.prisma.card.findFirst({ where: { id: dto.cardId, workspaceId: user.wid } });
    if (!card) throw new NotFoundException("Choose a card from this workspace");
    const data = {
      name: dto.name,
      cardId: dto.cardId,
      template: dto.template ?? "classic",
      theme: dto.theme ?? card.themeColor,
      showQr: dto.showQr ?? true,
      showPhoto: dto.showPhoto ?? true,
      showSocial: dto.showSocial ?? true,
    };
    const row = id
      ? await this.prisma.signature.update({ where: { id }, data, include: { card: true } })
      : await this.prisma.signature.create({ data: { ...data, workspaceId: user.wid }, include: { card: true } });
    await this.audit.log(user, id ? "signature.update" : "signature.create", "signature", row.id);
    return row;
  }

  async deleteSignature(user: AuthUser, id: string) {
    const row = await this.prisma.signature.findFirst({ where: { id, workspaceId: user.wid } });
    if (!row) throw new NotFoundException();
    await this.prisma.signature.delete({ where: { id } });
    await this.audit.log(user, "signature.delete", "signature", id);
    return { ok: true };
  }

  backgrounds(user: AuthUser) {
    return this.prisma.virtualBackground.findMany({ where: { workspaceId: user.wid }, include: { card: true }, orderBy: { createdAt: "desc" } });
  }

  async saveBackground(user: AuthUser, dto: BackgroundDto, id?: string) {
    const data = {
      name: dto.name,
      cardId: dto.cardId || null,
      jobTitle: dto.jobTitle ?? null,
      backgroundUrl: dto.backgroundUrl ?? null,
      accent: dto.accent ?? "#1aa3e8",
      showQr: dto.showQr ?? true,
      showLogo: dto.showLogo ?? true,
      showName: dto.showName ?? true,
      platform: dto.platform ?? "zoom",
    };
    const row = id
      ? await this.prisma.virtualBackground.update({ where: { id }, data, include: { card: true } })
      : await this.prisma.virtualBackground.create({ data: { ...data, workspaceId: user.wid }, include: { card: true } });
    await this.audit.log(user, id ? "background.update" : "background.create", "background", row.id);
    await this.prisma.analyticsEvent.create({ data: { workspaceId: user.wid, type: "ACTIVITY", cardId: dto.cardId } });
    return row;
  }

  async deleteBackground(user: AuthUser, id: string) {
    const row = await this.prisma.virtualBackground.findFirst({ where: { id, workspaceId: user.wid } });
    if (!row) throw new NotFoundException();
    await this.prisma.virtualBackground.delete({ where: { id } });
    return { ok: true };
  }
}

@Controller("signatures")
@UseGuards(AuthGuard)
export class SignaturesController {
  constructor(private studio: StudioService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.studio.signatures(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: SignatureDto) {
    return this.studio.saveSignature(user, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: SignatureDto) {
    return this.studio.saveSignature(user, dto, id);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.studio.deleteSignature(user, id);
  }
}

@Controller("backgrounds")
@UseGuards(AuthGuard)
export class BackgroundsController {
  constructor(private studio: StudioService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.studio.backgrounds(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: BackgroundDto) {
    return this.studio.saveBackground(user, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: BackgroundDto) {
    return this.studio.saveBackground(user, dto, id);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.studio.deleteBackground(user, id);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [SignaturesController, BackgroundsController],
  providers: [StudioService],
})
export class StudioModule {}
