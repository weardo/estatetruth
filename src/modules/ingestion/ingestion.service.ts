import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { HybridSearchService } from '../search/hybrid-search.service';
import { LuxuryPropertyEntity } from '../../data/luxury-estates.corpus';

export interface RawListingIngestJob {
  source: 'maharera_scraper' | 'dld_rest_feed' | 'resident_review_stream' | 'broker_feed';
  payload: LuxuryPropertyEntity;
}

/**
 * Async Event-Driven Ingestion Pipeline (BullMQ + Redis).
 * - Deduplicates messy broker listings via Entity Resolution (RERA ID + Canonical Name merge).
 * - Indexes updates into OpenSearch (BM25) + Qdrant (Dense Vector) asynchronously under real traffic.
 */
@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private readonly queue: Queue | null = null;
  private processedJobs = 0;

  constructor(private readonly searchService: HybridSearchService) {
    if (process.env.REDIS_URL) {
      try {
        const u = new URL(process.env.REDIS_URL);
        this.queue = new Queue('estatetruth-ingestion', {
          connection: {
            host: u.hostname,
            port: Number(u.port || 6379),
          },
        });
        this.logger.log(`BullMQ async ingestion queue connected to ${u.hostname}:${u.port || 6379}`);
      } catch {
        this.queue = null;
      }
    }
  }

  async enqueuePropertyUpdate(job: RawListingIngestJob) {
    // Immediate canonical entity resolution in search layer + async queue fan-out when Redis is attached
    const resolved = this.searchService.upsertResolvedEntity(job.payload);
    this.processedJobs++;

    if (this.queue) {
      await this.queue.add('upsert-entity-and-reindex', job, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 500,
      });
    }

    return {
      queued: Boolean(this.queue),
      entityResolutionAction: resolved.action,
      canonicalId: resolved.id,
      totalIngestedJobs: this.processedJobs,
    };
  }
}
