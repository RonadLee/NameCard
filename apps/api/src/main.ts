import "./env";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";

function assertProductionSecrets() {
  if (process.env.NODE_ENV !== "production") return;
  for (const name of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]) {
    const value = process.env[name] || "";
    if (value.length < 32 || value.includes("change-me")) {
      throw new Error(`${name} must be a unique secret of at least 32 characters before production starts`);
    }
  }
}

async function bootstrap() {
  assertProductionSecrets();
  const app = await NestFactory.create(AppModule);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  const origin = process.env.WEB_ORIGIN || "http://127.0.0.1:3000";
  app.enableCors({ origin, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  const port = Number(process.env.PORT || 4000);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
