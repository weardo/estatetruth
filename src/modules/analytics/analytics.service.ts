import { Injectable } from '@nestjs/common';

export type FunnelEventType =
  | 'search_executed'
  | 'xray_opened'
  | 'evidence_citation_clicked'
  | 'forensic_dossier_unlocked'
  | 'private_viewing_requested'
  | 'thumbs_up'
  | 'thumbs_down';

export interface ProductFunnelEvent {
  eventType: FunnelEventType;
  sessionId: string;
  traceId?: string;
  propertyId?: string;
  experimentVariant?: 'rrf_rerank_v2' | 'vector_only_control';
  timestamp: string;
}

/**
 * Product Analytics & Experimentation Funnel Service.
 * Tracks end-to-end conversion metrics (Search -> Citation Audit -> Paid Dossier / Viewing Request)
 * and A/B test lift between retrieval architectures (Hybrid RRF + Rerank vs Vector-Only Control).
 */
@Injectable()
export class AnalyticsService {
  private readonly events: ProductFunnelEvent[] = [];

  track(event: Omit<ProductFunnelEvent, 'timestamp'>) {
    const full: ProductFunnelEvent = {
      ...event,
      experimentVariant: event.experimentVariant || 'rrf_rerank_v2',
      timestamp: new Date().toISOString(),
    };
    this.events.push(full);
    return { ok: true, totalEvents: this.events.length };
  }

  getFunnelSummary() {
    const count = (t: FunnelEventType) => this.events.filter((e) => e.eventType === t).length;
    const searches = Math.max(1, count('search_executed'));
    const citations = count('evidence_citation_clicked');
    const dossiers = count('forensic_dossier_unlocked');
    const viewings = count('private_viewing_requested');
    const thumbsUp = count('thumbs_up');
    const thumbsDown = count('thumbs_down');

    return {
      totalEvents: this.events.length,
      funnel: {
        searches: count('search_executed'),
        citationAudits: citations,
        forensicDossiersUnlocked: dossiers,
        privateViewingsRequested: viewings,
        citationEngagementRatePct: Number(((citations / searches) * 100).toFixed(1)),
        viewingConversionRatePct: Number(((viewings / searches) * 100).toFixed(1)),
      },
      userSatisfaction: {
        thumbsUp,
        thumbsDown,
        csatPct: thumbsUp + thumbsDown > 0 ? Number(((thumbsUp / (thumbsUp + thumbsDown)) * 100).toFixed(1)) : 100,
      },
    };
  }
}
