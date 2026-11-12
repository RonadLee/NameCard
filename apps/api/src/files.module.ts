import { BadRequestException, Controller, Get, Injectable, Module, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { createReadStream, existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { Response } from "express";
import { AuthModule } from "./auth.module";
import { AuthGuard, AuthUser, CurrentUser } from "./common";
import { PrismaService } from "./prisma.service";

const root = join(process.cwd(), "uploads");

export interface ObjectStorage {
  save(id: string, bytes: Buffer): Promise<void>;
  read(id: string): Promise<Buffer>;
}

export class LocalStorage implements ObjectStorage {
  async save(id: string, bytes: Buffer) {
    await mkdir(root, { recursive: true });
    await writeFile(join(root, id), bytes);
  }
  read(id: string) {
    return readFile(join(root, id));
  }
}

export class FeishuStorage implements ObjectStorage {
  async save(id: string, bytes: Buffer) {
    const endpoint = process.env.FEISHU_STORAGE_ENDPOINT;
    if (!endpoint) throw new BadRequestException("Feishu storage is not configured");
    const res = await fetch(`${endpoint.replace(/\/$/, "")}/${id}`, { method: "PUT", body: bytes });
    if (!res.ok) throw new BadRequestException("Feishu storage rejected the upload");
  }
  async read(id: string) {
    const endpoint = process.env.FEISHU_STORAGE_ENDPOINT;
    if (!endpoint) throw new BadRequestException("Feishu storage is not configured");
    const res = await fetch(`${endpoint.replace(/\/$/, "")}/${id}`);
    if (!res.ok) throw new BadRequestException("Feishu storage could not read the file");
    return Buffer.from(await res.arrayBuffer());
  }
}

@Injectable()
export class FilesService {
  private driverName = process.env.STORAGE_DRIVER === "feishu" ? "feishu" : "local";
  private driver: ObjectStorage = this.driverName === "feishu" ? new FeishuStorage() : new LocalStorage();

  constructor(private prisma: PrismaService) {}

  async save(workspaceId: string, bytes: Buffer, mime: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new BadRequestException("Workspace not found");
    if (workspace.storageUsedBytes + bytes.length > workspace.storageLimitBytes) {
      throw new BadRequestException("Workspace storage is full");
    }
    const row = await this.prisma.storedFile.create({
      data: { workspaceId, key: "pending", mime, size: bytes.length, driver: this.driverName },
    });
    await this.driver.save(row.id, bytes);
    await this.prisma.storedFile.update({ where: { id: row.id }, data: { key: row.id } });
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { storageUsedBytes: { increment: bytes.length } },
    });
    return { id: row.id, url: `/api/files/${row.id}`, mime, size: bytes.length };
  }

  async open(id: string) {
    const row = await this.prisma.storedFile.findUnique({ where: { id } });
    if (!row) return null;
    if (row.driver === "local" && !existsSync(join(root, id))) return null;
    return { mime: row.mime, stream: row.driver === "local" ? createReadStream(join(root, id)) : undefined, bytes: row.driver === "local" ? undefined : await this.driver.read(id) };
  }
}

@Controller("files")
export class FilesController {
  constructor(private files: FilesService) {}

  @Post()
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 12 * 1024 * 1024 } }))
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("Choose a file to upload");
    return this.files.save(user.wid, file.buffer, file.mimetype || "application/octet-stream");
  }

  @Get(":id")
  async read(@Param("id") id: string, @Res() res: Response) {
    const file = await this.files.open(id);
    if (!file) {
      res.status(404).end();
      return;
    }
    res.setHeader("Content-Type", file.mime);
    res.setHeader("Cache-Control", "private, max-age=3600");
    if (file.stream) file.stream.pipe(res);
    else res.end(file.bytes);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
