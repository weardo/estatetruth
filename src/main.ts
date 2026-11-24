import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('EstateTruthBootstrap');
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true });

  const port = Number(process.env.PORT || 4000);
  await app.listen(port);
  logger.log(`EstateTruth AI MLOps NestJS Engine running on http://localhost:${port}`);
  logger.log(`Endpoints: POST /api/concierge/query | GET /api/concierge/stream | GET /api/observability/summary | GET /api/analytics/funnel`);
}

bootstrap();
