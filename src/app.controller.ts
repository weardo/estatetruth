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
import {
  LIVE_GOVT_SCHEMES,
  simulateGovtSchemeStack,
  compareGlobalCitiesEdge,
  GlobalCityKey,
  SchemeSimulationInput,
} from './modules/tools/lensroof-engines';

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
      llmCircuitStatus: this.llm.getCircuitStatus(),
      sqlitePersistence: true,
      cacheStats: this.db.getCacheStats(),
      corpusSize: this.search.getCorpus().length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Consumer Home Feed: Browse all verified luxury residences with clean filtering (Mumbai / Dubai / Safe Only).
   * Automatically merges any real buildings discovered & persisted via Live OpenStreetMap Ingestion!
   */
  @Get('properties')
  listProperties(
    @Query('city') city?: string,
    @Query('safeOnly') safeOnly?: string,
    @Query('userId') userId = 'guest_hni'
  ) {
    // Hydrate any persisted live-discovered OSM properties into the active search corpus
    const discovered = this.db.listDiscoveredProperties<any>();
    for (const d of discovered) {
      this.search.upsertResolvedEntity(d);
    }

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

  /**
   * Live Integration 1: Real-Time Neighborhood AQI, Elevation/Flood Watch, Weather & Nearby OSM POIs for ANY address.
   */
  @Post('tools/live-neighborhood')
  async liveNeighborhood(@Body() body: { address: string }) {
    const audit = await this.buyerTools.auditLiveNeighborhood(body.address || 'Worli Sea Face Mumbai');
    this.db.recordFunnelEvent('live_neighborhood_audit', 'tools_session');
    return { ok: true, audit };
  }

  /**
   * Live Integration 2: MahaRERA & Dubai DLD Registration Number Decoder & Statutory Verifier.
   */
  @Post('tools/verify-registry')
  verifyRegistry(@Body() body: { registrationId: string }) {
    const verification = this.buyerTools.verifyRegistry(
      body.registrationId || '',
      this.search.getCorpus()
    );
    this.db.recordFunnelEvent('registry_verifier_used', 'tools_session');
    return { ok: true, verification };
  }

  /**
   * Live Integration 3: Real-Time Market FX Rates (USD / INR / AED / GBP / EUR).
   */
  @Get('tools/fx-rates')
  async getFxRates() {
    const rates = await this.buyerTools.getLiveFxRates();
    return { ok: true, rates };
  }

  /**
   * Live Integration 4: Automated OpenStreetMap + Open-Meteo Public Building Discovery & Ingestion Pipeline.
   * Discovers real residential apartment buildings in ANY locality, enriches with live AQI & RERA/DLD district codes,
   * persists to SQLite, and indexes them into HybridSearchService immediately.
   */
  @Post('properties/discover-live')
  async discoverLiveProperties(@Body() body: { locality?: string }) {
    const locality = (body.locality || 'Bandra West Mumbai').trim();
    const discovered = await this.buyerTools.discoverLiveBuildingsFromOsm(locality);
    for (const prop of discovered) {
      this.search.upsertResolvedEntity(prop as any);
    }
    this.db.recordFunnelEvent('live_osm_building_discovery', 'ingestion_session');
    return {
      ok: true,
      locality,
      ingestedCount: discovered.length,
      totalCorpusSize: this.search.getCorpus().length,
      discovered,
    };
  }

  /**
   * Multi-Tier L1/L2 Cache & Circuit Breaker Telemetry Endpoint.
   */
  @Get('cache/stats')
  getCacheStats() {
    return {
      ok: true,
      cache: this.db.getCacheStats(),
      llmCircuit: this.llm.getCircuitStatus(),
      totalIndexedProperties: this.search.getCorpus().length,
    };
  }

  /**
   * Competitor-Killer Tool 5: Registered Sub-Registrar / DLD Sale Deed Comps + Tower Stack View + Negotiation Script.
   */
  @Get('tools/comps-stack/:propertyId')
  getCompsAndStack(@Param('propertyId') propertyId: string) {
    const discovered = this.db.listDiscoveredProperties<any>();
    for (const d of discovered) this.search.upsertResolvedEntity(d);
    const prop = this.search.getCorpus().find((e) => e.id === propertyId) || this.search.getCorpus()[0];
    this.db.recordFunnelEvent('comps_stack_used', 'tools_session', undefined, prop?.id);
    return {
      ok: true,
      compsStack: this.buyerTools.getRegisteredCompsAndStack(prop),
    };
  }

  /**
   * Autonomous Paid-Intent Checkout & Demand Capture (Tests real Willingness-To-Pay without human intervention!).
   */
  @Post('traction/paid-intent')
  recordPaidIntent(
    @Body()
    body: {
      sessionId?: string;
      userId?: string;
      productTier?: 'instant_dossier_4999' | 'advocate_title_14999' | 'nri_fema_desk_24999';
      priceInr?: number;
      propertyId?: string;
      propertyName?: string;
      buyerContact?: string;
      notes?: string;
    }
  ) {
    const lead = this.db.recordPaidIntentLead({
      sessionId: body.sessionId || 'autonomous_web_session',
      userId: body.userId || 'hni_buyer',
      productTier: body.productTier || 'instant_dossier_4999',
      priceInr: Number(body.priceInr || 4999),
      propertyId: body.propertyId,
      propertyName: body.propertyName,
      buyerContact: (body.buyerContact || '').trim() || 'anonymous_hni_intent',
      notes: body.notes,
    });
    if (body.propertyId) {
      this.db.unlockDossier(body.userId || 'hni_buyer', body.propertyId);
    }
    return { ok: true, lead };
  }

  /**
   * Autonomous 24/7 Founder Traction, PMF Scorecard & Competitor Wedge Dashboard.
   */
  @Get('traction/dashboard')
  getTractionDashboard() {
    const discovered = this.db.listDiscoveredProperties<any>();
    for (const d of discovered) this.search.upsertResolvedEntity(d);
    return {
      ok: true,
      traction: this.db.getAutonomousTractionDashboard(this.search.getCorpus().length),
      competitorMatrix: this.buyerTools.getCompetitorAuditMatrix(),
    };
  }

  /**
   * Indian Government Housing Schemes & Multi-Layer Stacking Simulator
   */
  @Get('schemes')
  listGovtSchemes() {
    return { ok: true, count: LIVE_GOVT_SCHEMES.length, schemes: LIVE_GOVT_SCHEMES };
  }

  @Post('schemes/simulate')
  simulateGovtSchemes(@Body() body: Partial<SchemeSimulationInput>) {
    const simulation = simulateGovtSchemeStack({
      city: body.city || 'Mumbai',
      annualHouseholdIncomeLakh: Number(body.annualHouseholdIncomeLakh || 8),
      propertyBudgetLakh: Number(body.propertyBudgetLakh || 35),
      isFirstTimeBuyer: body.isFirstTimeBuyer !== false,
      hasFemaleCoOwner: body.hasFemaleCoOwner !== false,
      isUnderConstruction: body.isUnderConstruction !== false,
      category: body.category || 'MIG',
    });
    this.db.recordFunnelEvent('govt_scheme_simulated', 'schemes_session');
    return { ok: true, simulation };
  }

  /**
   * Global Cross-Border "Apples-to-Apples" Property Comparator (Mumbai, Dubai, London, Singapore, New York)
   */
  @Post('global/compare')
  async compareGlobalCities(
    @Body() body: { cityA?: GlobalCityKey; cityB?: GlobalCityKey; budgetUsdMillions?: number }
  ) {
    const comparison = await compareGlobalCitiesEdge(
      body.cityA || 'Mumbai',
      body.cityB || 'Dubai',
      Number(body.budgetUsdMillions || 1.5)
    );
    this.db.recordFunnelEvent('global_compare_used', 'global_session');
    return { ok: true, comparison };
  }
}
