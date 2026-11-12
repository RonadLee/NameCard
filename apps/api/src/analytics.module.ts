import { Controller, Get, Injectable, Module, Query, Res, UseGuards } from "@nestjs/common";
import ExcelJS from "exceljs";
import type { Response } from "express";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { AuthModule } from "./auth.module";
import { AuthGuard, AuthUser, CurrentUser } from "./common";
import { PrismaService } from "./prisma.service";

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async report(user: AuthUser, days = 30) {
    const since = new Date(Date.now() - days * 86400000);
    const [events, cards] = await Promise.all([
      this.prisma.analyticsEvent.findMany({ where: { workspaceId: user.wid, createdAt: { gte: since } } }),
      this.prisma.card.findMany({ where: { workspaceId: user.wid }, select: { id: true, name: true, company: true } }),
    ]);
    const totals = emptyTotals();
    const byDay = new Map<string, ReturnType<typeof emptyTotals>>();
    const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 12 }, () => 0));
    const byCard = new Map<string, number>();
    for (const event of events) {
      const key = event.type.toLowerCase() as keyof ReturnType<typeof emptyTotals>;
      if (key in totals) totals[key] += 1;
      const day = event.createdAt.toISOString().slice(0, 10);
      const bucket = byDay.get(day) ?? emptyTotals();
      if (key in bucket) bucket[key] += 1;
      byDay.set(day, bucket);
      heatmap[event.createdAt.getUTCDay()][Math.floor(event.createdAt.getUTCHours() / 2)] += 1;
      if (event.cardId) byCard.set(event.cardId, (byCard.get(event.cardId) ?? 0) + 1);
    }
    const series = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const date = new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
      series.push({ date, ...(byDay.get(date) ?? emptyTotals()) });
    }
    return {
      days,
      totals,
      series,
      heatmap,
      cards: cards
        .map((card) => ({ ...card, events: byCard.get(card.id) ?? 0 }))
        .sort((a, b) => b.events - a.events),
    };
  }

  async xlsx(user: AuthUser) {
    const report = await this.report(user, 30);
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Activity");
    sheet.addRow(["Date", "Views", "Shares", "Scans", "Downloads", "Saves", "Activity"]);
    for (const row of report.series) sheet.addRow([row.date, row.view, row.share, row.scan, row.download, row.save, row.activity]);
    return Buffer.from(await book.xlsx.writeBuffer());
  }

  async pdf(user: AuthUser) {
    const report = await this.report(user, 30);
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    page.drawText("NameCard activity report", { x: 48, y: 790, size: 22, font: bold, color: rgb(0.1, 0.12, 0.14) });
    page.drawText("Last 30 days", { x: 48, y: 764, size: 12, font, color: rgb(0.4, 0.45, 0.5) });
    const lines = [
      ["Card views", report.totals.view],
      ["Shares", report.totals.share],
      ["QR scans", report.totals.scan],
      ["Downloads", report.totals.download],
      ["Contact saves", report.totals.save],
      ["Team activity", report.totals.activity],
    ];
    lines.forEach(([label, value], index) => {
      page.drawText(String(label), { x: 48, y: 710 - index * 28, size: 13, font, color: rgb(0.2, 0.24, 0.28) });
      page.drawText(String(value), { x: 240, y: 710 - index * 28, size: 13, font: bold, color: rgb(0.1, 0.64, 0.91) });
    });
    return Buffer.from(await doc.save());
  }
}

function emptyTotals() {
  return { view: 0, share: 0, scan: 0, download: 0, save: 0, activity: 0 };
}

@Controller("analytics")
@UseGuards(AuthGuard)
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Get()
  report(@CurrentUser() user: AuthUser, @Query("days") days?: string) {
    return this.analytics.report(user, Number(days) || 30);
  }

  @Get("export/xlsx")
  async xlsx(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const bytes = await this.analytics.xlsx(user);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=analytics.xlsx");
    res.end(bytes);
  }

  @Get("export/pdf")
  async pdf(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const bytes = await this.analytics.pdf(user);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=analytics.pdf");
    res.end(bytes);
  }
}

@Module({ imports: [AuthModule], controllers: [AnalyticsController], providers: [AnalyticsService] })
export class AnalyticsModule {}
