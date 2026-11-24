import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { MultiAgentOrchestratorService } from './modules/agents/multi-agent-orchestrator.service';
import { HybridSearchService } from './modules/search/hybrid-search.service';
import { ObservabilityService } from './modules/observability/observability.service';
import { IngestionService } from './modules/ingestion/ingestion.service';
import { AnalyticsService } from './modules/analytics/analytics.service';
import { MessagingController } from './modules/messaging/messaging.controller';

@Module({
  imports: [],
  controllers: [AppController, MessagingController],
  providers: [
    ObservabilityService,
    HybridSearchService,
    MultiAgentOrchestratorService,
    IngestionService,
    AnalyticsService,
  ],
})
export class AppModule {}
