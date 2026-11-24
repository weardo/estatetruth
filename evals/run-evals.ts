import * as fs from 'fs';
import * as path from 'path';
import { HybridSearchService } from '../src/modules/search/hybrid-search.service';
import { ObservabilityService } from '../src/modules/observability/observability.service';
import { MultiAgentOrchestratorService } from '../src/modules/agents/multi-agent-orchestrator.service';

interface GoldenCase {
  id: string;
  category: string;
  query: string;
  expectedTopIds: string[];
  forbiddenIds: string[];
  expectedCity: string;
}

function computeDcg(relevances: number[]): number {
  return relevances.reduce((acc, rel, idx) => acc + (Math.pow(2, rel) - 1) / Math.log2(idx + 2), 0);
}

function computeNdcgAtK(predictedIds: string[], expectedIds: string[], forbiddenIds: string[], k = 5): number {
  const rels = predictedIds.slice(0, k).map((id) => {
    if (expectedIds.includes(id)) return 2;
    if (forbiddenIds.includes(id)) return 0;
    return 0.5;
  });
  const ideal = [...rels].sort((a, b) => b - a);
  // Ensure ideal starts with expected matches
  const idealRels = [
    ...expectedIds.slice(0, k).map(() => 2),
    ...Array(Math.max(0, k - expectedIds.length)).fill(0.5),
  ].slice(0, k);
  const idcg = computeDcg(idealRels);
  return idcg === 0 ? 1 : Number((computeDcg(rels) / idcg).toFixed(4));
}

function computeMrr(predictedIds: string[], expectedIds: string[]): number {
  for (let i = 0; i < predictedIds.length; i++) {
    if (expectedIds.includes(predictedIds[i])) return Number((1 / (i + 1)).toFixed(4));
  }
  return 0;
}

async function runEvaluationSuite() {
  const isCiMode = process.argv.includes('--ci');
  const datasetPath = path.join(__dirname, 'golden_dataset.json');
  const goldenCases: GoldenCase[] = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));

  const observability = new ObservabilityService();
  const searchService = new HybridSearchService();
  const orchestrator = new MultiAgentOrchestratorService(searchService, observability);

  let bm25NdcgSum = 0;
  let vectorNdcgSum = 0;
  let hybridNdcgSum = 0;

  let bm25MrrSum = 0;
  let vectorMrrSum = 0;
  let hybridMrrSum = 0;

  let faithfulnessSum = 0;
  let negationPassCount = 0;
  let selfHealVerified = false;

  console.log(`\n═══════════════════════════════════════════════════════════════════════`);
  console.log(`  ESTATETRUTH AI — AUTOMATED MLOPS RELEVANCE & LLM-AS-JUDGE EVAL SUITE`);
  console.log(`  Golden Cases: ${goldenCases.length} | Mode: ${isCiMode ? 'CI REGRESSION GATE' : 'LOCAL BENCHMARK'}`);
  console.log(`═══════════════════════════════════════════════════════════════════════\n`);

  for (const tc of goldenCases) {
    const res = await orchestrator.runConciergeWorkflow({
      query: tc.query,
      sessionId: `eval_${tc.id}`,
      userId: 'ci_evaluator',
    });

    const bm25Ids = res.searchComparisons.find((c) => c.mode === 'bm25_only')!.topResultIds;
    const vecIds = res.searchComparisons.find((c) => c.mode === 'vector_only')!.topResultIds;
    const hybridIds = res.verifiedDossiers.map((d) => d.propertyId);

    const bNdcg = computeNdcgAtK(bm25Ids, tc.expectedTopIds, tc.forbiddenIds, 3);
    const vNdcg = computeNdcgAtK(vecIds, tc.expectedTopIds, tc.forbiddenIds, 3);
    const hNdcg = computeNdcgAtK(hybridIds, tc.expectedTopIds, tc.forbiddenIds, 3);

    bm25NdcgSum += bNdcg;
    vectorNdcgSum += vNdcg;
    hybridNdcgSum += hNdcg;

    bm25MrrSum += computeMrr(bm25Ids, tc.expectedTopIds);
    vectorMrrSum += computeMrr(vecIds, tc.expectedTopIds);
    hybridMrrSum += computeMrr(hybridIds, tc.expectedTopIds);

    faithfulnessSum += res.judgeVerdict.faithfulnessScore;
    const leakedForbidden = hybridIds.some((id) => tc.forbiddenIds.includes(id));
    if (!leakedForbidden) negationPassCount++;

    console.log(
      `[${tc.id}] ${tc.category.padEnd(28)} | NDCG: BM25=${bNdcg.toFixed(2)} Vec=${vNdcg.toFixed(2)} Hybrid=${hNdcg.toFixed(2)} | Judge=${res.judgeVerdict.faithfulnessScore.toFixed(2)} | Negation=${leakedForbidden ? 'FAIL' : 'PASS'}`
    );
  }

  // Also test the cyclic LangGraph Self-Healing Hallucination Recovery & Circuit Breaker!
  const selfHealRes = await orchestrator.runConciergeWorkflow({
    query: goldenCases[0].query,
    sessionId: 'eval_self_heal_test',
    simulateInitialHallucination: true,
  });
  selfHealVerified = selfHealRes.selfHealIterations === 1 && selfHealRes.judgeVerdict.passed;

  const n = goldenCases.length;
  const metrics = {
    bm25AvgNdcg: Number((bm25NdcgSum / n).toFixed(3)),
    vectorAvgNdcg: Number((vectorNdcgSum / n).toFixed(3)),
    hybridAvgNdcg: Number((hybridNdcgSum / n).toFixed(3)),
    bm25AvgMrr: Number((bm25MrrSum / n).toFixed(3)),
    vectorAvgMrr: Number((vectorMrrSum / n).toFixed(3)),
    hybridAvgMrr: Number((hybridMrrSum / n).toFixed(3)),
    avgFaithfulness: Number((faithfulnessSum / n).toFixed(3)),
    negationComplianceRate: Number((negationPassCount / n).toFixed(3)),
    selfHealLoopVerified: selfHealVerified,
  };

  console.log(`\n──────────────────── AGGREGATE BENCHMARK RESULTS ──────────────────────`);
  console.table([
    { Retriever: 'BM25 Only (OpenSearch Lexical)', 'Avg NDCG@3': metrics.bm25AvgNdcg, 'Avg MRR': metrics.bm25AvgMrr },
    { Retriever: 'Vector Only (Qdrant Dense)', 'Avg NDCG@3': metrics.vectorAvgNdcg, 'Avg MRR': metrics.vectorAvgMrr },
    { Retriever: 'Hybrid RRF + Negation Cross-Encoder', 'Avg NDCG@3': metrics.hybridAvgNdcg, 'Avg MRR': metrics.hybridAvgMrr },
  ]);
  console.log(`LLM-as-Judge Faithfulness : ${(metrics.avgFaithfulness * 100).toFixed(1)}% (Gate >= 90.0%)`);
  console.log(`Hard Negation Compliance  : ${(metrics.negationComplianceRate * 100).toFixed(1)}% (Gate >= 95.0%)`);
  console.log(`Self-Healing Judge Loop   : ${metrics.selfHealLoopVerified ? 'VERIFIED (Caught trap -> cycled -> healed)' : 'FAILED'}`);
  console.log(`───────────────────────────────────────────────────────────────────────\n`);

  if (isCiMode) {
    const failures: string[] = [];
    if (metrics.hybridAvgNdcg < 0.85) failures.push(`Hybrid NDCG ${metrics.hybridAvgNdcg} < 0.85`);
    if (metrics.hybridAvgNdcg <= metrics.vectorAvgNdcg) failures.push('Hybrid RRF failed to outperform Vector-only baseline');
    if (metrics.avgFaithfulness < 0.9) failures.push(`Faithfulness ${metrics.avgFaithfulness} < 0.90`);
    if (metrics.negationComplianceRate < 0.95) failures.push(`Negation Compliance ${metrics.negationComplianceRate} < 0.95`);
    if (!metrics.selfHealLoopVerified) failures.push('LangGraph self-healing loop test failed');

    if (failures.length > 0) {
      console.error('❌ CI REGRESSION GATE FAILED:', failures.join(' | '));
      process.exit(1);
    }
    console.log('✅ CI REGRESSION GATE PASSED — Safe to deploy to production!');
  }
}

runEvaluationSuite().catch((err) => {
  console.error(err);
  process.exit(1);
});
