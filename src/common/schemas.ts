import { z } from 'zod';

/**
 * Strict Zod schema for Query Understanding & Negation Extraction (Node 1 of LangGraph).
 * Enforces structured output so downstream Hybrid Retrieval + Geo Filters never receive ambiguous strings.
 */
export const ParsedQuerySchema = z.object({
  rawQuery: z.string(),
  intent: z.enum(['discovery', 'forensic_audit', 'comparison', 'pricing_check']),
  targetCity: z.enum(['Mumbai', 'Dubai', 'Any']),
  targetMicroMarket: z.string().nullable(),
  maxBudgetCroreInr: z.number().nullable(),
  minCarpetSqFt: z.number().nullable(),
  minBhk: z.number().nullable(),
  mustHaveConstraints: z.array(z.string()),
  hardNegations: z.array(z.string()), // e.g., ["no_rera_litigation", "no_highway_noise", "no_dogs", "no_airbnb_party", "no_metro_construction"]
  requireStepFreeAccess: z.boolean(),
  requirePrivateElevator: z.boolean(),
  requireSeaView: z.boolean(),
  requireOcReceived: z.boolean(),
  maxNightNoiseDb: z.number().nullable(),
  routingTier: z.enum(['fast-tier', 'frontier-tier']),
});

export type ParsedQuery = z.infer<typeof ParsedQuerySchema>;

export const VerifiedCitationSchema = z.object({
  evidenceId: z.string(),
  source: z.string(),
  verifiedTag: z.string(),
  quote: z.string(),
});

export const PropertyDossierSchema = z.object({
  propertyId: z.string(),
  canonicalName: z.string(),
  developer: z.string().optional(),
  heroImage: z.string().optional(),
  microMarket: z.string(),
  city: z.enum(['Mumbai', 'Dubai']),
  priceCroreInr: z.number(),
  priceUsdMillions: z.number(),
  trueCarpetSqFt: z.number(),
  brokerAdvertisedSqFt: z.number(),
  carpetInflationPct: z.number(),
  reraId: z.string(),
  reraStatus: z.string(),
  activeReraLitigations: z.number(),
  ambientNoiseDbNight: z.number(),
  truthScore: z.number().min(0).max(100),
  hybridRrfScore: z.number(),
  rerankScore: z.number(),
  brokerClaim: z.string(),
  verifiedRealitySummary: z.string(),
  matchedConstraints: z.array(z.string()),
  redFlagsDetected: z.array(z.string()),
  citations: z.array(VerifiedCitationSchema),
});

export type PropertyDossier = z.infer<typeof PropertyDossierSchema>;

export const JudgeVerdictSchema = z.object({
  passed: z.boolean(),
  faithfulnessScore: z.number().min(0).max(1),
  negationComplianceScore: z.number().min(0).max(1),
  geoAccuracyScore: z.number().min(0).max(1),
  citationCoverageScore: z.number().min(0).max(1),
  violations: z.array(z.string()),
  selfHealInstruction: z.string().nullable(),
});

export type JudgeVerdict = z.infer<typeof JudgeVerdictSchema>;

export interface TraceSpan {
  spanId: string;
  parentSpanId?: string;
  name: string;
  nodeType: 'agent' | 'retrieval' | 'llm' | 'judge' | 'tool';
  modelUsed?: string;
  routingTier?: 'fast-tier' | 'frontier-tier' | 'deterministic';
  promptCacheHit?: boolean;
  fallbackTriggered?: boolean;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  metadata: Record<string, unknown>;
}

export interface SearchModeComparison {
  mode: 'bm25_only' | 'vector_only' | 'hybrid_rrf_rerank';
  topResultIds: string[];
  topResultNames: string[];
  negationTrapCaught: boolean;
  estimatedNdcgAt5: number;
  latencyMs: number;
}
