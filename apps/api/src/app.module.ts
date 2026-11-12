import "./env";
import { Controller, Get, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AnalyticsModule } from "./analytics.module";
import { AuthModule } from "./auth.module";
import { CardsModule } from "./cards.module";
import { ContactsModule } from "./contacts.module";
import { CoreModule } from "./core.module";
import { FilesModule } from "./files.module";
import { OrgModule } from "./org.module";
import { ScansModule } from "./scans.module";
import { StudioModule } from "./studio.module";

@Controller()
class HealthController {
  @Get("health")
  health() {
    return { ok: true, service: "namecard-api" };
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 300 }] }),
    CoreModule,
    AuthModule,
    FilesModule,
    CardsModule,
    ContactsModule,
    ScansModule,
    StudioModule,
    OrgModule,
    AnalyticsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
