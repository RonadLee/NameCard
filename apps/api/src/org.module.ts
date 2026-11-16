import { BadRequestException, Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { Plan, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { IsArray, IsEmail, IsIn, IsOptional, IsString } from "class-validator";
import { randomBytes } from "crypto";
import { AuthModule } from "./auth.module";
import { atLeast, AuditService, AuthGuard, AuthUser, CurrentUser, Roles, RolesGuard } from "./common";
import { PrismaService } from "./prisma.service";

class DepartmentDto {
  @IsString() name: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsString() feishuDepartmentId?: string;
}

class TeamDto {
  @IsString() name: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsArray() memberIds?: string[];
}

class InviteDto {
  @IsString() name: string;
  @IsEmail() email: string;
  @IsIn(["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"]) role: Role;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() title?: string;
}

class PlanDto {
  @IsIn(["PERSONAL", "TEAM"]) plan: Plan;
}

class MemberDto {
  @IsIn(["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"]) role: Role;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() title?: string;
}

@Injectable()
export class OrgService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async overview(user: AuthUser) {
    const [workspace, departments, teams, members, approvals, audits] = await Promise.all([
      this.prisma.workspace.findUnique({ where: { id: user.wid } }),
      this.prisma.department.findMany({ where: { workspaceId: user.wid }, include: { children: true } }),
      this.prisma.team.findMany({ where: { workspaceId: user.wid }, include: { members: true, department: true } }),
      this.prisma.membership.findMany({ where: { workspaceId: user.wid }, include: { user: true, department: true } }),
      this.prisma.approvalRequest.findMany({ where: { workspaceId: user.wid }, include: { requester: true }, orderBy: { createdAt: "desc" } }),
      this.prisma.auditLog.findMany({ where: { workspaceId: user.wid }, include: { actor: true }, orderBy: { createdAt: "desc" }, take: 80 }),
    ]);
    return {
      workspace,
      departments,
      teams,
      members: members.map((item) => ({
        id: item.id,
        role: item.role,
        title: item.title,
        departmentId: item.departmentId,
        department: item.department?.name ?? null,
        user: { id: item.user.id, name: item.user.name, email: item.user.email, mfaEnabled: item.user.mfaEnabled, feishuOpenId: item.user.feishuOpenId },
      })),
      approvals,
      audits: audits.map((item) => ({ ...item, actor: item.actor ? { id: item.actor.id, name: item.actor.name } : null })),
    };
  }

  async saveDepartment(user: AuthUser, dto: DepartmentDto, id?: string) {
    this.admin(user);
    if (dto.parentId) await this.departmentInWorkspace(user, dto.parentId);
    const row = id
      ? await this.prisma.department.update({ where: { id: (await this.departmentInWorkspace(user, id)).id }, data: dto })
      : await this.prisma.department.create({ data: { ...dto, workspaceId: user.wid } });
    await this.audit.log(user, id ? "department.update" : "department.create", "department", row.id);
    return row;
  }

  async deleteDepartment(user: AuthUser, id: string) {
    this.admin(user);
    await this.departmentInWorkspace(user, id);
    const [children, members, teams] = await Promise.all([
      this.prisma.department.count({ where: { parentId: id } }),
      this.prisma.membership.count({ where: { departmentId: id } }),
      this.prisma.team.count({ where: { departmentId: id } }),
    ]);
    if (children || members || teams) throw new BadRequestException("Move teams and people out of this department before deleting it");
    await this.prisma.department.delete({ where: { id } });
    await this.audit.log(user, "department.delete", "department", id);
    return { ok: true };
  }

  async saveTeam(user: AuthUser, dto: TeamDto, id?: string) {
    this.admin(user);
    if (dto.departmentId) await this.departmentInWorkspace(user, dto.departmentId);
    await this.membersInWorkspace(user, dto.memberIds);
    if (id) await this.teamInWorkspace(user, id);
    const row = id
      ? await this.prisma.team.update({
          where: { id },
          data: { name: dto.name, ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId || null } : {}) },
        })
      : await this.prisma.team.create({ data: { name: dto.name, departmentId: dto.departmentId || null, workspaceId: user.wid } });
    if (dto.memberIds) {
      await this.prisma.teamMember.deleteMany({ where: { teamId: row.id } });
      if (dto.memberIds.length) await this.prisma.teamMember.createMany({ data: dto.memberIds.map((userId) => ({ teamId: row.id, userId })) });
    }
    await this.audit.log(user, id ? "team.update" : "team.create", "team", row.id);
    return this.prisma.team.findUnique({ where: { id: row.id }, include: { members: true, department: true } });
  }

  async deleteTeam(user: AuthUser, id: string) {
    this.admin(user);
    await this.teamInWorkspace(user, id);
    await this.prisma.team.delete({ where: { id } });
    await this.audit.log(user, "team.delete", "team", id);
    return { ok: true };
  }

  async invite(user: AuthUser, dto: InviteDto) {
    this.admin(user);
    if (dto.departmentId) await this.departmentInWorkspace(user, dto.departmentId);
    const email = dto.email.toLowerCase();
    const temporaryPassword = `Nc-${randomBytes(4).toString("hex")}`;
    let created = false;
    let account = await this.prisma.user.findUnique({ where: { email } });
    if (!account) {
      created = true;
      account = await this.prisma.user.create({
        data: { email, name: dto.name, passwordHash: await bcrypt.hash(temporaryPassword, 10) },
      });
    }
    await this.prisma.membership.upsert({
      where: { userId_workspaceId: { userId: account.id, workspaceId: user.wid } },
      update: { role: dto.role, departmentId: dto.departmentId || null, title: dto.title },
      create: { userId: account.id, workspaceId: user.wid, role: dto.role, departmentId: dto.departmentId || null, title: dto.title },
    });
    await this.audit.log(user, "member.invite", "user", account.id, { email, role: dto.role });
    return { userId: account.id, email, temporaryPassword: created ? temporaryPassword : undefined };
  }

  async updateMember(user: AuthUser, userId: string, dto: MemberDto) {
    this.admin(user);
    if (userId === user.sub) throw new BadRequestException("Ask another admin to change your own role");
    const membership = await this.membershipInWorkspace(user, userId);
    if (dto.departmentId) await this.departmentInWorkspace(user, dto.departmentId);
    await this.keepAnAdmin(user, membership.role, dto.role, userId);
    const updated = await this.prisma.membership.update({
      where: { id: membership.id },
      data: {
        role: dto.role,
        title: dto.title,
        departmentId: dto.departmentId === undefined ? membership.departmentId : dto.departmentId || null,
      },
    });
    await this.audit.log(user, "member.role", "user", userId, { role: dto.role });
    return updated;
  }

  async removeMember(user: AuthUser, userId: string) {
    this.admin(user);
    if (userId === user.sub) throw new BadRequestException("You cannot remove yourself");
    const membership = await this.membershipInWorkspace(user, userId);
    await this.keepAnAdmin(user, membership.role, "USER", userId);
    await this.prisma.teamMember.deleteMany({ where: { userId, team: { workspaceId: user.wid } } });
    await this.prisma.membership.delete({ where: { id: membership.id } });
    await this.audit.log(user, "member.remove", "user", userId);
    return { ok: true };
  }

  async setPlan(user: AuthUser, plan: Plan) {
    this.admin(user);
    const workspace = await this.prisma.workspace.update({
      where: { id: user.wid },
      data: { plan, storageLimitBytes: plan === "TEAM" ? 5 * 1024 * 1024 * 1024 : 500 * 1024 * 1024 },
    });
    await this.audit.log(user, "workspace.plan", "workspace", user.wid, { plan });
    return workspace;
  }

  async decide(user: AuthUser, id: string, status: "APPROVED" | "REJECTED") {
    this.admin(user);
    const approval = await this.prisma.approvalRequest.findFirst({ where: { id, workspaceId: user.wid } });
    if (!approval) throw new NotFoundException("Approval not found");
    const updated = await this.prisma.approvalRequest.update({ where: { id }, data: { status, decidedAt: new Date() } });
    const payload = updated.payload as { cardId?: string };
    if (status === "APPROVED" && updated.type === "card.publish" && payload.cardId) {
      await this.prisma.card.updateMany({ where: { id: payload.cardId, workspaceId: user.wid }, data: { visibility: "TEAM" } });
    }
    await this.audit.log(user, `approval.${status.toLowerCase()}`, "approval", id);
    return updated;
  }

  async mapFeishu(user: AuthUser, openId: string, unionId?: string) {
    return this.prisma.user.update({ where: { id: user.sub }, data: { feishuOpenId: openId, feishuUnionId: unionId } });
  }

  async syncDepartments(user: AuthUser, departments: { id: string; name: string; parentId?: string }[]) {
    this.admin(user);
    const created = [];
    for (const department of departments) {
      const existing = await this.prisma.department.findFirst({ where: { workspaceId: user.wid, feishuDepartmentId: department.id } });
      const parent = department.parentId
        ? await this.prisma.department.findFirst({ where: { workspaceId: user.wid, feishuDepartmentId: department.parentId } })
        : null;
      const row = existing
        ? await this.prisma.department.update({ where: { id: existing.id }, data: { name: department.name, parentId: parent?.id } })
        : await this.prisma.department.create({
            data: { workspaceId: user.wid, name: department.name, feishuDepartmentId: department.id, parentId: parent?.id },
          });
      created.push(row);
    }
    await this.audit.log(user, "feishu.directory_sync", "department", undefined, { count: created.length });
    return { synced: created.length, departments: created };
  }

  status() {
    return {
      identity: Boolean(process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET),
      directory: Boolean(process.env.FEISHU_APP_ID),
      approval: Boolean(process.env.FEISHU_APP_ID),
      bitable: Boolean(process.env.FEISHU_APP_ID),
      storage: process.env.STORAGE_DRIVER === "feishu" && Boolean(process.env.FEISHU_STORAGE_ENDPOINT),
      openPlatform: Boolean(process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET),
      ocr: {
        gptVision: Boolean(process.env.OPENAI_API_KEY),
        paddle: Boolean(process.env.PADDLE_OCR_URL),
        tesseract: true,
      },
    };
  }

  private admin(user: AuthUser) {
    if (!atLeast(user.role, "ADMIN")) throw new BadRequestException("An admin has to do that");
  }

  private async departmentInWorkspace(user: AuthUser, id: string) {
    const row = await this.prisma.department.findFirst({ where: { id, workspaceId: user.wid } });
    if (!row) throw new NotFoundException("Department not found");
    return row;
  }

  private async teamInWorkspace(user: AuthUser, id: string) {
    const row = await this.prisma.team.findFirst({ where: { id, workspaceId: user.wid } });
    if (!row) throw new NotFoundException("Team not found");
    return row;
  }

  private async membershipInWorkspace(user: AuthUser, userId: string) {
    const row = await this.prisma.membership.findUnique({ where: { userId_workspaceId: { userId, workspaceId: user.wid } } });
    if (!row) throw new NotFoundException("Member not found");
    return row;
  }

  private async membersInWorkspace(user: AuthUser, userIds?: string[]) {
    if (!userIds?.length) return;
    const count = await this.prisma.membership.count({ where: { workspaceId: user.wid, userId: { in: userIds } } });
    if (count !== new Set(userIds).size) throw new BadRequestException("Every team member has to belong to this workspace");
  }

  private async keepAnAdmin(user: AuthUser, current: Role, next: Role, userId: string) {
    const leavingAdmin = (current === "ADMIN" || current === "SUPER_ADMIN") && next !== "ADMIN" && next !== "SUPER_ADMIN";
    if (!leavingAdmin) return;
    const others = await this.prisma.membership.count({
      where: { workspaceId: user.wid, userId: { not: userId }, role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    });
    if (!others) throw new BadRequestException("The workspace needs at least one admin");
  }
}

@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class OrgController {
  constructor(private org: OrgService) {}

  @Get("org")
  overview(@CurrentUser() user: AuthUser) {
    return this.org.overview(user);
  }

  @Post("departments")
  @Roles("ADMIN")
  createDepartment(@CurrentUser() user: AuthUser, @Body() dto: DepartmentDto) {
    return this.org.saveDepartment(user, dto);
  }

  @Patch("departments/:id")
  @Roles("ADMIN")
  updateDepartment(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: DepartmentDto) {
    return this.org.saveDepartment(user, dto, id);
  }

  @Delete("departments/:id")
  @Roles("ADMIN")
  deleteDepartment(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.org.deleteDepartment(user, id);
  }

  @Post("teams")
  @Roles("ADMIN")
  createTeam(@CurrentUser() user: AuthUser, @Body() dto: TeamDto) {
    return this.org.saveTeam(user, dto);
  }

  @Patch("teams/:id")
  @Roles("ADMIN")
  updateTeam(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: TeamDto) {
    return this.org.saveTeam(user, dto, id);
  }

  @Delete("teams/:id")
  @Roles("ADMIN")
  deleteTeam(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.org.deleteTeam(user, id);
  }

  @Post("members")
  @Roles("ADMIN")
  invite(@CurrentUser() user: AuthUser, @Body() dto: InviteDto) {
    return this.org.invite(user, dto);
  }

  @Patch("members/:userId")
  @Roles("ADMIN")
  updateMember(@CurrentUser() user: AuthUser, @Param("userId") userId: string, @Body() dto: MemberDto) {
    return this.org.updateMember(user, userId, dto);
  }

  @Delete("members/:userId")
  @Roles("ADMIN")
  removeMember(@CurrentUser() user: AuthUser, @Param("userId") userId: string) {
    return this.org.removeMember(user, userId);
  }

  @Patch("workspace/plan")
  @Roles("ADMIN")
  plan(@CurrentUser() user: AuthUser, @Body() dto: PlanDto) {
    return this.org.setPlan(user, dto.plan);
  }

  @Post("approvals/:id")
  @Roles("ADMIN")
  decide(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: { status: "APPROVED" | "REJECTED" }) {
    return this.org.decide(user, id, body.status);
  }

  @Post("integrations/feishu/mapping")
  map(@CurrentUser() user: AuthUser, @Body() body: { openId: string; unionId?: string }) {
    return this.org.mapFeishu(user, body.openId, body.unionId);
  }

  @Post("integrations/feishu/directory/sync")
  @Roles("ADMIN")
  sync(@CurrentUser() user: AuthUser, @Body() body: { departments: { id: string; name: string; parentId?: string }[] }) {
    return this.org.syncDepartments(user, body.departments ?? []);
  }

  @Get("integrations/status")
  integrationStatus() {
    return this.org.status();
  }
}

@Module({ imports: [AuthModule], controllers: [OrgController], providers: [OrgService] })
export class OrgModule {}
