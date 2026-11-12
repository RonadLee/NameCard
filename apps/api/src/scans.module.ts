import { BadRequestException, Body, Controller, Get, Injectable, Module, NotFoundException, Param, Patch, Post, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { Allow } from "class-validator";
import { FilesInterceptor } from "@nestjs/platform-express";
import { createHash } from "crypto";
import { tmpdir } from "os";
import { join } from "path";
import sharp from "sharp";
import { AuthModule } from "./auth.module";
import { asJson, AuditService, AuthGuard, AuthUser, CurrentUser, publicId } from "./common";
import { FilesModule, FilesService } from "./files.module";
import { overallConfidence, parseCardText, ParsedCard } from "./parse-card";
import { PrismaService } from "./prisma.service";

type OcrHit = { text: string; confidence: number; engine: string };

async function recognize(bytes: Buffer, mime: string, language: string): Promise<OcrHit> {
  if (process.env.OPENAI_API_KEY) {
    const gpt = await gptVision(bytes, mime);
    if (gpt) return gpt;
  }
  if (process.env.PADDLE_OCR_URL) {
    const paddleHit = await paddle(bytes);
    if (paddleHit) return paddleHit;
  }
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker(language || "eng", 1, { cachePath: join(tmpdir(), "namecard-tesseract") });
    const result = await worker.recognize(bytes);
    await worker.terminate();
    return { text: result.data.text || "", confidence: (result.data.confidence || 0) / 100, engine: "tesseract" };
  } catch (error) {
    return { text: "", confidence: 0, engine: "tesseract", ...(error instanceof Error ? { note: error.message } : {}) } as OcrHit;
  }
}

async function gptVision(bytes: Buffer, mime: string): Promise<OcrHit | null> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Read this business card. Return only the visible text, one field per line." },
          { type: "image_url", image_url: { url: `data:${mime};base64,${bytes.toString("base64")}` } },
        ],
      }],
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return { text: json.choices?.[0]?.message?.content ?? "", confidence: 0.9, engine: "gpt-vision" };
}

async function paddle(bytes: Buffer): Promise<OcrHit | null> {
  const res = await fetch(process.env.PADDLE_OCR_URL as string, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: bytes.toString("base64") }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { text?: string; confidence?: number };
  return { text: json.text ?? "", confidence: json.confidence ?? 0.75, engine: "paddleocr" };
}

async function prepareImage(bytes: Buffer) {
  try {
    const rotated = sharp(bytes).rotate();
    const trimmed = await rotated.clone().trim({ threshold: 12 }).toBuffer().catch(async () => rotated.toBuffer());
    const stats = await sharp(trimmed).stats();
    const sharpness = stats.channels[0]?.stdev ?? 0;
    const output = sharpness < 18 ? await sharp(trimmed).median(3).sharpen().png().toBuffer() : await sharp(trimmed).png().toBuffer();
    return { bytes: output, sharpness, note: sharpness < 18 ? "Low sharpness. A denoise pass was applied." : "Auto-rotated from EXIF and trimmed to the card edges." };
  } catch {
    return { bytes, sharpness: null as number | null, note: "The original image was kept because it could not be normalized." };
  }
}

async function pdfText(bytes: Buffer) {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const result = await extractText(pdf, { mergePages: true });
    const text = Array.isArray(result.text) ? result.text.join("\n") : String(result.text ?? "");
    return text;
  } catch {
    return "";
  }
}

@Injectable()
export class ScansService {
  constructor(
    private prisma: PrismaService,
    private files: FilesService,
    private audit: AuditService,
  ) {}

  list(user: AuthUser) {
    return this.prisma.scanItem.findMany({ where: { workspaceId: user.wid }, orderBy: { createdAt: "desc" }, take: 100 });
  }

  async ingest(user: AuthUser, files: Express.Multer.File[], language: string) {
    if (!files.length) throw new BadRequestException("Upload at least one image or PDF");
    const batchId = publicId();
    const items = [];
    for (const file of files) {
      items.push(await this.one(user, file, language || "eng", batchId));
    }
    await this.audit.log(user, "scan.batch", "scan", batchId, { count: items.length });
    return { batchId, items };
  }

  async update(user: AuthUser, id: string, fields: ParsedCard) {
    const row = await this.must(user, id);
    const saved = await this.prisma.scanItem.update({
      where: { id: row.id },
      data: { fields: asJson(fields), confidence: overallConfidence(fields) },
    });
    return saved;
  }

  async save(user: AuthUser, id: string) {
    const row = await this.must(user, id);
    const fields = row.fields as ParsedCard;
    if (!fields?.name) throw new BadRequestException("Add a name before saving");
    const contact = await this.prisma.contact.create({
      data: {
        workspaceId: user.wid,
        ownerId: user.sub,
        name: fields.name,
        nameZh: fields.nameZh || null,
        nameEn: fields.nameEn || null,
        company: fields.company || null,
        jobTitle: fields.jobTitle || null,
        email: fields.email || null,
        mobile: fields.mobile || null,
        phone: fields.phone || null,
        website: fields.website || null,
        address: fields.address || null,
        socials: asJson(fields.socials ?? []),
        cardImageUrl: row.imageUrl,
        source: "scan",
        tags: ["Scanned"],
      },
    });
    await this.prisma.scanItem.update({ where: { id }, data: { status: "SAVED" } });
    await this.prisma.analyticsEvent.create({ data: { workspaceId: user.wid, type: "SCAN" } });
    await this.audit.log(user, "scan.save", "contact", contact.id, { scanId: id });
    return contact;
  }

  async rotate(user: AuthUser, id: string) {
    const row = await this.must(user, id);
    if (!row.imageUrl) throw new BadRequestException("This scan has no image");
    const fileId = row.imageUrl.split("/").pop() as string;
    const opened = await this.files.open(fileId);
    if (!opened) throw new NotFoundException("Image file is missing");
    const bytes = opened.bytes ?? (await streamToBuffer(opened.stream));
    const turned = await sharp(bytes).rotate(90).png().toBuffer();
    const stored = await this.files.save(user.wid, turned, "image/png");
    const ocr = await recognize(turned, "image/png", row.language);
    const fields = parseCardText(ocr.text);
    return this.prisma.scanItem.update({
      where: { id },
      data: {
        imageUrl: stored.url,
        rawText: ocr.text,
        fields: asJson(fields),
        confidence: overallConfidence(fields),
        rotation: (row.rotation + 90) % 360,
        engine: ocr.engine,
      },
    });
  }

  private async one(user: AuthUser, file: Express.Multer.File, language: string, batchId: string) {
    const mime = file.mimetype || "application/octet-stream";
    const isPdf = mime.includes("pdf") || file.originalname.toLowerCase().endsWith(".pdf");
    let note = "";
    let imageUrl: string | null = null;
    let sharpness: number | null = null;
    let text = "";
    let engine = "none";
    if (isPdf) {
      const stored = await this.files.save(user.wid, file.buffer, mime);
      imageUrl = stored.url;
      text = await pdfText(file.buffer);
      engine = text ? "pdf-text" : "none";
      note = text ? "Text was extracted from the PDF." : "No text layer was found. Enter the fields manually.";
    } else {
      const prepared = await prepareImage(file.buffer);
      sharpness = prepared.sharpness;
      note = prepared.note;
      const stored = await this.files.save(user.wid, prepared.bytes, "image/png");
      imageUrl = stored.url;
      const ocr = await recognize(prepared.bytes, "image/png", language);
      text = ocr.text;
      engine = ocr.engine;
      if (!text) note = `${note} OCR returned no text. Check the image or type the fields.`;
    }
    const fields = parseCardText(text);
    const duplicateOf = await this.duplicate(user.wid, fields, file.buffer);
    return this.prisma.scanItem.create({
      data: {
        workspaceId: user.wid,
        userId: user.sub,
        batchId,
        imageUrl,
        fileName: file.originalname,
        rawText: text,
        language,
        fields: asJson(fields),
        confidence: overallConfidence(fields),
        sharpness,
        duplicateOf,
        engine,
        note,
      },
    });
  }

  private async duplicate(workspaceId: string, fields: ParsedCard, bytes: Buffer) {
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (fields.email) {
      const byEmail = await this.prisma.contact.findFirst({ where: { workspaceId, email: { equals: fields.email, mode: "insensitive" } } });
      if (byEmail) return byEmail.id;
    }
    if (fields.mobile && fields.name) {
      const byPhone = await this.prisma.contact.findFirst({ where: { workspaceId, mobile: fields.mobile, name: fields.name } });
      if (byPhone) return byPhone.id;
    }
    const sameFile = await this.prisma.scanItem.findFirst({ where: { workspaceId, rawText: hash } });
    return sameFile?.id ?? null;
  }

  private async must(user: AuthUser, id: string) {
    const row = await this.prisma.scanItem.findFirst({ where: { id, workspaceId: user.wid } });
    if (!row) throw new NotFoundException("Scan not found");
    return row;
  }
}

function streamToBuffer(stream?: NodeJS.ReadableStream) {
  if (!stream) return Promise.resolve(Buffer.alloc(0));
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

class ScanFieldsDto {
  @Allow() name: string;
  @Allow() nameZh: string;
  @Allow() nameEn: string;
  @Allow() company: string;
  @Allow() jobTitle: string;
  @Allow() email: string;
  @Allow() mobile: string;
  @Allow() phone: string;
  @Allow() website: string;
  @Allow() address: string;
  @Allow() socials: { network: string; url: string }[];
  @Allow() confidence: Record<string, number>;
}

@Controller("scans")
@UseGuards(AuthGuard)
export class ScansController {
  constructor(private scans: ScansService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.scans.list(user);
  }

  @Post()
  @UseInterceptors(FilesInterceptor("files", 20, { limits: { fileSize: 12 * 1024 * 1024 } }))
  create(@CurrentUser() user: AuthUser, @UploadedFiles() files: Express.Multer.File[], @Body("language") language?: string) {
    return this.scans.ingest(user, files ?? [], language || "eng");
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() fields: ScanFieldsDto) {
    return this.scans.update(user, id, fields as ParsedCard);
  }

  @Post(":id/save")
  save(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.scans.save(user, id);
  }

  @Post(":id/rotate")
  rotate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.scans.rotate(user, id);
  }
}

@Module({ imports: [AuthModule, FilesModule], controllers: [ScansController], providers: [ScansService] })
export class ScansModule {}
