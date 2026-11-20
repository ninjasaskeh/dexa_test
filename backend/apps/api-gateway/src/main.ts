import 'dotenv/config';
process.env.TZ ??= 'Asia/Jakarta';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  // Foto bukti tidak disajikan statis: hanya lewat GET /api/attendance/:id/photo yang dicek login & kepemilikannya
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(','),
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  });
  app.enableShutdownHooks();
  const port = Number(process.env.GATEWAY_PORT ?? 3000);
  await app.listen(port);
  new Logger('ApiGateway').log(`🚀 API Gateway running on http://localhost:${port}/api`);
}
bootstrap();
