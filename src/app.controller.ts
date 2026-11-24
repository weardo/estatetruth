import { Body, Controller, Get, Post, Sse, MessageEvent, Query } from '@nestjs/common';
import { Observable } from 'rxjs';
import { MultiAgentOrchestratorService } from './modules/agents/multi-agent-orchestrator.service';
import { ObservabilityService } from './modules/observability/observability.service';
import { AnalyticsService, FunnelEventType } from './modules/analytics/analytics.service';
import { IngestionService, RawListingIngestJob } from './modules/ingestion/ingestion.service';
import { HybridSearchService } from './modules/search/hybrid-search.service';

@Controller('api')
export class AppController {
  constructor(
    private readonly orchestrator: MultiAgentOrchestratorService,
    private readonly observability: ObservabilityService,
    private readonly analytics: AnalyticsService,
    private readonly ingestion: IngestionService,
    private readonly search: HybridSearchService
  ) {}

  @Get('health')
  health() {
    return {
      ok: true,
      service: 'EstateTruth AI — Production Multi-Agent MLOps Engine (NestJS + LangGraph + Langfuse + Qdrant/OpenSearch)',
      corpusSize: this.search.getCorpus().length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Main Customer-Facing Concierge Endpoint (JSON response with full Langfuse trace + search benchmark).
   */
  @Post('concierge/query')
  async queryConcierge(
    @Body()
    body: {
      query: string;
      sessionId?: string;
      userId?: string;
      simulateInitialHallucination?: boolean;
    }
  ) {
    const result = await this.orchestrator.runConciergeWorkflow({
      query: body.query,
      sessionId: body.sessionId,
      userId: body.userId,
      channel: 'web',
      simulateInitialHallucination: body.simulateInitialHallucination,
    });

    this.analytics.track({
      eventType: 'search_executed',
      sessionId: result.sessionId,
      traceId: result.traceId,
    });

    return { ok: true, ...result };
  }

  /**
   * Server-Sent Events (SSE) Streaming Endpoint so the frontend renders each LangGraph agent step live!
   */
  @Sse('concierge/stream')
  streamConcierge(
    @Query('query') query: string,
    @Query('sessionId') sessionId?: string,
    @Query('simulateHallucination') simulateHallucination?: string
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      (async () => {
        try {
          subscriber.next({ data: { stage: 'query_understanding', status: 'running' } });
          const result = await this.orchestrator.runConciergeWorkflow({
            query: query || 'Sea-facing 4BHK in Worli, zero MahaRERA litigation, quiet',
            sessionId,
            simulateInitialHallucination: simulateHallucination === 'true',
          });
          for (const span of result.langfuseTrace.spans) {
            subscriber.next({ data: { stage: span.name, status: 'completed', span } });
          }
          subscriber.next({ data: { stage: 'final', status: 'done', result } });
          subscriber.complete();
        } catch (err) {
          subscriber.error(err);
        }
      })();
    });
  }

  @Get('observability/summary')
  getObservabilitySummary() {
    return { ok: true, ...this.observability.getObservabilitySummary() };
  }

  @Get('analytics/funnel')
  getAnalyticsFunnel() {
    return { ok: true, ...this.analytics.getFunnelSummary() };
  }

  @Post('analytics/event')
  trackAnalyticsEvent(
    @Body()
    body: {
      eventType: FunnelEventType;
      sessionId: string;
      traceId?: string;
      propertyId?: string;
    }
  ) {
    return this.analytics.track(body);
  }

  @Post('ingestion/enqueue')
  enqueueIngestion(@Body() body: RawListingIngestJob) {
    return this.ingestion.enqueuePropertyUpdate(body);
  }
}
