import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { MultiAgentOrchestratorService } from './modules/agents/multi-agent-orchestrator.service';
import { HybridSearchService } from './modules/search/hybrid-search.service';
import { ObservabilityService } from './modules/observability/observability.service';
import { IngestionService } from './modules/ingestion/ingestion.service';
import { AnalyticsService } from './modules/analytics/analytics.service';
import { MessagingController } from './modules/messaging/messaging.controller';
import { DatabaseService } from './modules/storage/database.service';
import { GeminiLlmService } from './modules/llm/gemini-llm.service';
import { LiveGeoService } from './modules/geo/live-geo.service';
import { BuyerToolsService } from './modules/tools/buyer-tools.service';

@Module({
  imports: [],
  controllers: [AppController, MessagingController],
  providers: [
    DatabaseService,
    GeminiLlmService,
    LiveGeoService,
    BuyerToolsService,
    ObservabilityService,
    HybridSearchService,
    MultiAgentOrchestratorService,
    IngestionService,
    AnalyticsService,
  ],
})
export class AppModule {}
