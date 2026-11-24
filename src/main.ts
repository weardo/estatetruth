import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('EstateTruthBootstrap');
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true });

  const port = Number(process.env.PORT || 4000);
  await app.listen(port, '0.0.0.0');
  logger.log(`EstateTruth AI MLOps NestJS Engine running on http://0.0.0.0:${port} (LAN: http://192.168.1.53:${port})`);
  logger.log(`Endpoints: POST /api/concierge/query | GET /api/concierge/stream | GET /api/observability/summary | GET /api/analytics/funnel`);
}

bootstrap();
