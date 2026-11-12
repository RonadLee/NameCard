import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { Throttle } from "@nestjs/throttler";
import { Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";
import { randomBytes } from "crypto";
import type { Request, Response } from "express";
import * as OTPAuth from "otpauth";
import { AuditService, AuthGuard, AuthUser, CurrentUser, decrypt, encrypt, Roles, RolesGuard, sha256 } from "./common";
import { PrismaService } from "./prisma.service";

const COOKIE = "nc_refresh";
const WEEK = 30 * 24 * 3600 * 1000;

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  mfaCode?: string;
}

class MfaDto {
  @IsString()
  @MinLength(6)
  code: string;
}

class SwitchDto {
  @IsString()
  workspaceId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private audit: AuditService,
  ) {}

  private async tokenPair(user: { id: string; email: string; name: string }, workspaceId: string, role: Role) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      wid: workspaceId,
      role,
      email: user.email,
      name: user.name,
    } satisfies AuthUser);
    const raw = randomBytes(32).toString("base64url");
    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + WEEK) },
    });
    return { accessToken, refresh: raw };
  }

  private profile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { include: { workspace: true, department: true } } },
    });
  }

  async login(dto: LoginDto, res: Response) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Email or password is incorrect");
    }
    if (user.mfaEnabled) {
      if (!dto.mfaCode) return { mfaRequired: true };
      const secret = decrypt(user.mfaSecretEnc || "");
      const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30 });
      if (totp.validate({ token: dto.mfaCode, window: 1 }) === null) {
        throw new UnauthorizedException("Authentication code is incorrect");
      }
    }
    const membership = await this.prisma.membership.findFirst({ where: { userId: user.id }, include: { workspace: true } });
    if (!membership) throw new UnauthorizedException("No workspace is assigned to this account");
    const pair = await this.tokenPair(user, membership.workspaceId, membership.role);
    this.setCookie(res, pair.refresh);
    await this.audit.log({ sub: user.id, wid: membership.workspaceId }, "auth.login", "user", user.id);
    const full = await this.profile(user.id);
    return { accessToken: pair.accessToken, user: this.publicUser(full!), workspace: membership.workspace };
  }

  async refresh(req: Request, res: Response) {
    const raw = req.cookies?.[COOKIE] as string | undefined;
    if (!raw) throw new UnauthorizedException();
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(raw) }, include: { user: true } });
    if (!row || row.expiresAt.getTime() < Date.now()) throw new UnauthorizedException();
    const membership = await this.prisma.membership.findFirst({ where: { userId: row.userId }, include: { workspace: true } });
    if (!membership) throw new UnauthorizedException();
    await this.prisma.refreshToken.delete({ where: { id: row.id } });
    const pair = await this.tokenPair(row.user, membership.workspaceId, membership.role);
    this.setCookie(res, pair.refresh);
    const full = await this.profile(row.userId);
    return { accessToken: pair.accessToken, user: this.publicUser(full!), workspace: membership.workspace };
  }

  async logout(req: Request, res: Response) {
    const raw = req.cookies?.[COOKIE] as string | undefined;
    if (raw) await this.prisma.refreshToken.deleteMany({ where: { tokenHash: sha256(raw) } });
    res.clearCookie(COOKIE, { path: "/api/auth" });
    return { ok: true };
  }

  async switchWorkspace(user: AuthUser, workspaceId: string, res: Response) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: user.sub, workspaceId } },
      include: { workspace: true, user: true },
    });
    if (!membership) throw new ForbiddenWorkspace();
    const pair = await this.tokenPair(membership.user, workspaceId, membership.role);
    this.setCookie(res, pair.refresh);
    const full = await this.profile(user.sub);
    return { accessToken: pair.accessToken, user: this.publicUser(full!), workspace: membership.workspace };
  }

  async me(user: AuthUser) {
    const full = await this.profile(user.sub);
    const workspace = full?.memberships.find((item) => item.workspaceId === user.wid)?.workspace;
    return { user: this.publicUser(full!), workspace, role: user.role };
  }

  async setupMfa(user: AuthUser) {
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({ issuer: "NameCard", label: user.email, secret, digits: 6, period: 30 });
    await this.prisma.user.update({ where: { id: user.sub }, data: { mfaSecretEnc: encrypt(secret.base32), mfaEnabled: false } });
    return { otpauth: totp.toString(), secret: secret.base32 };
  }

  async enableMfa(user: AuthUser, code: string) {
    const row = await this.prisma.user.findUnique({ where: { id: user.sub } });
    if (!row?.mfaSecretEnc) throw new BadRequestException("Set up an authenticator before enabling it");
    const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(decrypt(row.mfaSecretEnc)), digits: 6, period: 30 });
    if (totp.validate({ token: code, window: 1 }) === null) throw new BadRequestException("Authentication code is incorrect");
    await this.prisma.user.update({ where: { id: user.sub }, data: { mfaEnabled: true } });
    await this.audit.log(user, "auth.mfa_enabled", "user", user.sub);
    return { mfaEnabled: true };
  }

  private setCookie(res: Response, refresh: string) {
    res.cookie(COOKIE, refresh, { httpOnly: true, sameSite: "lax", path: "/api/auth", maxAge: WEEK });
  }

  private publicUser(user: NonNullable<Awaited<ReturnType<AuthService["profile"]>>>) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      nameZh: user.nameZh,
      title: user.title,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      locale: user.locale,
      mfaEnabled: user.mfaEnabled,
      feishuOpenId: user.feishuOpenId,
      feishuUnionId: user.feishuUnionId,
      memberships: user.memberships.map((item) => ({
        role: item.role,
        title: item.title,
        department: item.department?.name ?? null,
        workspace: { id: item.workspace.id, name: item.workspace.name, slug: item.workspace.slug, plan: item.workspace.plan },
      })),
    };
  }
}

class ForbiddenWorkspace extends UnauthorizedException {
  constructor() {
    super("You are not a member of that workspace");
  }
}

@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post("login")
  @Throttle({ default: { limit: 12, ttl: 60000 } })
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(dto, res);
  }

  @Post("refresh")
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.refresh(req, res);
  }

  @Post("logout")
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout(req, res);
  }

  @Post("switch")
  @UseGuards(AuthGuard)
  switchWorkspace(@CurrentUser() user: AuthUser, @Body() dto: SwitchDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.switchWorkspace(user, dto.workspaceId, res);
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  @Post("mfa/setup")
  @UseGuards(AuthGuard)
  setup(@CurrentUser() user: AuthUser) {
    return this.auth.setupMfa(user);
  }

  @Post("mfa/enable")
  @UseGuards(AuthGuard, RolesGuard)
  enable(@CurrentUser() user: AuthUser, @Body() dto: MfaDto) {
    return this.auth.enableMfa(user, dto.code);
  }
}

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || "dev-access-secret-change-me",
      signOptions: { expiresIn: "15m" },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, RolesGuard],
  exports: [AuthGuard, RolesGuard, JwtModule, AuthService],
})
export class AuthModule {}
