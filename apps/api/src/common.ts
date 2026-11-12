import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Prisma, Role } from "@prisma/client";
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "crypto";
import { PrismaService } from "./prisma.service";

export type AuthUser = {
  sub: string;
  wid: string;
  role: Role;
  email: string;
  name: string;
};

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().user as AuthUser;
});

const RANK: Record<Role, number> = { USER: 1, MANAGER: 2, ADMIN: 3, SUPER_ADMIN: 4 };

export function atLeast(role: Role, minimum: Role) {
  return RANK[role] >= RANK[minimum];
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService) {}

  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const header = String(req.headers.authorization ?? "");
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) throw new UnauthorizedException();
    try {
      req.user = this.jwt.verify(token);
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}

export const ROLES_KEY = "roles";
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;
    const user = ctx.switchToHttp().getRequest().user as AuthUser;
    const minimum = Math.min(...roles.map((role) => RANK[role]));
    if (RANK[user.role] < minimum) throw new ForbiddenException("You do not have permission for this action");
    return true;
  }
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  log(user: Pick<AuthUser, "sub" | "wid">, action: string, entity: string, entityId?: string, meta?: unknown) {
    return this.prisma.auditLog.create({
      data: {
        workspaceId: user.wid,
        actorId: user.sub,
        action,
        entity,
        entityId,
        meta: meta === undefined ? undefined : (meta as Prisma.InputJsonValue),
      },
    });
  }
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function publicId() {
  return randomBytes(6).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toLowerCase();
}

function key() {
  return scryptSync(process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-change-me", "namecard-mfa", 32);
}

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, data]).toString("base64url");
}

export function decrypt(payload: string) {
  const buf = Buffer.from(payload, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
