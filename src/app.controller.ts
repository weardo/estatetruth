import { Body, Controller, Get, Param, Post, Query, Sse, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { MultiAgentOrchestratorService } from './modules/agents/multi-agent-orchestrator.service';
import { ObservabilityService } from './modules/observability/observability.service';
import { AnalyticsService, FunnelEventType } from './modules/analytics/analytics.service';
import { IngestionService, RawListingIngestJob } from './modules/ingestion/ingestion.service';
import { HybridSearchService } from './modules/search/hybrid-search.service';
import { DatabaseService } from './modules/storage/database.service';
import { GeminiLlmService } from './modules/llm/gemini-llm.service';
import { BuyerToolsService, TrueCostInput } from './modules/tools/buyer-tools.service';

@Controller('api')
export class AppController {
  constructor(
    private readonly orchestrator: MultiAgentOrchestratorService,
    private readonly observability: ObservabilityService,
    private readonly analytics: AnalyticsService,
    private readonly ingestion: IngestionService,
    private readonly search: HybridSearchService,
    private readonly db: DatabaseService,
    private readonly llm: GeminiLlmService,
    private readonly buyerTools: BuyerToolsService
  ) {}

  @Get('health')
  health() {
    return {
      ok: true,
      service: 'EstateTruth AI — Luxury Real Estate Forensics & MLOps Platform',
      liveGeminiConnected: this.llm.isLiveReady(),
      sqlitePersistence: true,
      corpusSize: this.search.getCorpus().length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Consumer Home Feed: Browse all verified luxury residences with clean filtering (Mumbai / Dubai / Safe Only).
   */
  @Get('properties')
  listProperties(
    @Query('city') city?: string,
    @Query('safeOnly') safeOnly?: string,
    @Query('userId') userId = 'guest_hni'
  ) {
    const savedIds = new Set(this.db.listSavedProperties(userId).map((r) => r.property_id));
    const unlockedIds = new Set(this.db.listUnlockedDossiers(userId));

    let items = this.search.getCorpus().map((e) => {
      const carpetInflationPct = Math.round(
        ((e.brokerAdvertisedSqFt - e.trueCarpetSqFt) / e.trueCarpetSqFt) * 100
      );
      const truthScore = Math.max(
        18,
        Math.min(
          98,
          Math.round(
            100 -
              e.activeReraLitigations * 9 -
              (e.reraStatus === 'DELAYED_EXTENSION' ? 18 : 0) -
              (e.ambientNoiseDbNight > 55 ? 16 : 0) -
              Math.max(0, carpetInflationPct - 35) * 0.4
          )
        )
      );
      return {
        ...e,
        carpetInflationPct,
        truthScore,
        isSaved: savedIds.has(e.id),
        isDossierUnlocked: unlockedIds.has(e.id),
      };
    });

    if (city && city !== 'All') {
      items = items.filter((p) => p.city.toLowerCase() === city.toLowerCase());
    }
    if (safeOnly === 'true') {
      items = items.filter((p) => p.activeReraLitigations === 0 && p.truthScore >= 75);
    }

    items.sort((a, b) => b.truthScore - a.truthScore);
    return { ok: true, count: items.length, properties: items };
  }

  /**
   * Single Property Full Forensic Dossier Detail.
   */
  @Get('properties/:id')
  getPropertyDetail(@Param('id') id: string, @Query('userId') userId = 'guest_hni') {
    const entity = this.search.getCorpus().find((e) => e.id === id);
    if (!entity) return { ok: false, error: 'Property not found' };

    const savedIds = new Set(this.db.listSavedProperties(userId).map((r) => r.property_id));
    const unlockedIds = new Set(this.db.listUnlockedDossiers(userId));
    const carpetInflationPct = Math.round(
      ((entity.brokerAdvertisedSqFt - entity.trueCarpetSqFt) / entity.trueCarpetSqFt) * 100
    );
    const truthScore = Math.max(
      18,
      Math.min(
        98,
        Math.round(
          100 -
            entity.activeReraLitigations * 9 -
            (entity.reraStatus === 'DELAYED_EXTENSION' ? 18 : 0) -
            (entity.ambientNoiseDbNight > 55 ? 16 : 0) -
            Math.max(0, carpetInflationPct - 35) * 0.4
        )
      )
    );

    return {
      ok: true,
      property: {
        ...entity,
        carpetInflationPct,
        truthScore,
        isSaved: savedIds.has(entity.id),
        isDossierUnlocked: unlockedIds.has(entity.id),
      },
    };
  }

  /**
   * Toggle Saved Shortlist Property (Persisted in SQLite WAL).
   */
  @Post('saved/toggle')
  toggleSaved(@Body() body: { userId?: string; propertyId: string }) {
    const userId = body.userId || 'guest_hni';
    const entity = this.search.getCorpus().find((e) => e.id === body.propertyId);
    if (!entity) return { ok: false, error: 'Property not found' };
    const result = this.db.toggleSavedProperty(userId, entity.id, entity.canonicalName);
    return { ok: true, ...result, propertyId: entity.id };
  }

  @Get('saved')
  getSaved(@Query('userId') userId = 'guest_hni') {
    const rows = this.db.listSavedProperties(userId);
    const ids = new Set(rows.map((r) => r.property_id));
    const properties = this.search.getCorpus().filter((e) => ids.has(e.id));
    return { ok: true, saved: rows, properties };
  }

  /**
   * Unlock Full Paid Forensic RERA & 30-Yr Title Dossier (Persisted in SQLite WAL).
   */
  @Post('dossiers/unlock')
  unlockDossier(@Body() body: { userId?: string; propertyId: string; sessionId?: string }) {
    const userId = body.userId || 'guest_hni';
    const res = this.db.unlockDossier(userId, body.propertyId);
    this.db.recordFunnelEvent('forensic_dossier_unlocked', body.sessionId || userId, undefined, body.propertyId);
    return { ok: true, ...res };
  }

  /**
   * Book Buyer-Side Private Viewing (Persisted in SQLite WAL).
   */
  @Post('bookings')
  createBooking(
    @Body()
    body: {
      userId?: string;
      propertyId: string;
      buyerName: string;
      buyerContact: string;
      preferredDate?: string;
      notes?: string;
    }
  ) {
    const userId = body.userId || 'guest_hni';
    const entity = this.search.getCorpus().find((e) => e.id === body.propertyId);
    if (!entity) return { ok: false, error: 'Property not found' };

    const booking = this.db.createBooking({
      userId,
      propertyId: entity.id,
      canonicalName: entity.canonicalName,
      buyerName: body.buyerName || 'Private Client',
      buyerContact: body.buyerContact || 'WhatsApp Concierge',
      preferredDate: body.preferredDate || 'This Weekend · Chauffeur Pickup',
      notes: body.notes,
    });
    this.db.recordFunnelEvent('private_viewing_requested', userId, undefined, entity.id);
    return { ok: true, booking };
  }

  @Get('bookings')
  listBookings(@Query('userId') userId = 'guest_hni') {
    return { ok: true, bookings: this.db.listBookings(userId) };
  }

  /**
   * Persisted Multi-Turn Chat History.
   */
  @Get('chat/history')
  getChatHistory(@Query('sessionId') sessionId = 'default_session') {
    return { ok: true, turns: this.db.getChatHistory(sessionId, 20) };
  }

  /**
   * Main Customer-Facing AI Advisor Endpoint (LangGraph 5-Node + Live Gemini 4 + Live OSM Geo + SQLite).
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
    this.db.recordFunnelEvent('search_executed', result.sessionId, result.traceId);

    return { ok: true, ...result };
  }

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
    return {
      ok: true,
      liveGeminiConnected: this.llm.isLiveReady(),
      persistedTraces: this.db.getRecentTraces(20),
      ...this.observability.getObservabilitySummary(),
    };
  }

  @Get('analytics/funnel')
  getAnalyticsFunnel() {
    return {
      ok: true,
      persistedCounts: this.db.getFunnelCounts(),
      ...this.analytics.getFunnelSummary(),
    };
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
    this.db.recordFunnelEvent(body.eventType, body.sessionId, body.traceId, body.propertyId);
    return this.analytics.track(body);
  }

  @Post('ingestion/enqueue')
  enqueueIngestion(@Body() body: RawListingIngestJob) {
    return this.ingestion.enqueuePropertyUpdate(body);
  }

  /**
   * High-Intent Google Search Tool 1: True Landing Cost, Hidden Charges, Carpet Loading & NRI TDS X-Ray.
   */
  @Post('tools/true-cost')
  calculateTrueCost(@Body() body: TrueCostInput) {
    const breakdown = this.buyerTools.calculateTrueCost({
      city: body.city === 'Dubai' ? 'Dubai' : 'Mumbai',
      agreementPriceCroreInr: Number(body.agreementPriceCroreInr || 30),
      advertisedSqFt: Number(body.advertisedSqFt || 4200),
      reraCarpetSqFt: Number(body.reraCarpetSqFt || 2800),
      isUnderConstruction: Boolean(body.isUnderConstruction),
      isNriTransaction: Boolean(body.isNriTransaction),
    });
    this.db.recordFunnelEvent('true_cost_xray_used', 'tools_session');
    return { ok: true, breakdown };
  }

  /**
   * High-Intent Google Search Tool 2: Live Gemini 4 Builder-Buyer Agreement & Broker Pitch Red-Flag Scanner.
   */
  @Post('tools/scan-agreement')
  async scanAgreement(@Body() body: { text: string; city?: 'Mumbai' | 'Dubai' }) {
    const scan = await this.buyerTools.scanAgreementOrPitch(
      body.text || '',
      body.city === 'Dubai' ? 'Dubai' : 'Mumbai'
    );
    this.db.recordFunnelEvent('agreement_scanner_used', 'tools_session');
    return { ok: true, scan };
  }
}
