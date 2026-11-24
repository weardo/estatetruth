import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { HybridSearchService } from '../../../src/modules/search/hybrid-search.service';
import { ObservabilityService } from '../../../src/modules/observability/observability.service';
import { MultiAgentOrchestratorService } from '../../../src/modules/agents/multi-agent-orchestrator.service';

/**
 * EstateTruth AI — Model Context Protocol (MCP) Server
 * Allows Wealth Managers, Family Offices, Claude Desktop, Cursor, or Antigravity to call
 * EstateTruth's verified Hybrid Geo-Search & MahaRERA/DLD Forensic Audit tools directly!
 */
const observability = new ObservabilityService();
const searchService = new HybridSearchService();
const orchestrator = new MultiAgentOrchestratorService(searchService, observability);

const server = new Server(
  {
    name: 'estatetruth-ai-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search_verified_estates',
      description:
        'Run the 5-Node LangGraph Multi-Agent Luxury Real Estate Forensics workflow with Hybrid BM25+Vector RRF, hard negation filtering, MahaRERA/DLD checks, and LLM-as-Judge verification.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Natural language luxury property query including negations (e.g., "Sea-facing 4BHK in Worli under 40 Cr, zero RERA litigation, no highway noise, private elevator")',
          },
          sessionId: { type: 'string' },
        },
        required: ['query'],
      },
    },
    {
      name: 'audit_rera_compliance',
      description:
        'Forensic due-diligence audit for a named luxury residence or alias (e.g. "Imperial Crown Heights", "360 West Worli", "Orla Palm Jumeirah"). Returns MahaRERA/DLD litigation counts, true vs advertised carpet inflation, and ambient noise sensors.',
      inputSchema: {
        type: 'object',
        properties: {
          propertyName: { type: 'string' },
        },
        required: ['propertyName'],
      },
    },
    {
      name: 'compare_retrieval_relevance',
      description:
        'Benchmark BM25-only vs Vector-only vs Hybrid RRF + Negation-Aware Rerank on a specific query and inspect NDCG@5 and negation trap detection.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const input = (args || {}) as Record<string, string>;

  if (name === 'search_verified_estates') {
    const res = await orchestrator.runConciergeWorkflow({
      query: input.query,
      sessionId: input.sessionId || 'mcp_session',
      channel: 'mcp',
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
    };
  }

  if (name === 'audit_rera_compliance') {
    const res = await orchestrator.runConciergeWorkflow({
      query: `Forensic audit and litigation check for ${input.propertyName}`,
      sessionId: 'mcp_audit',
      channel: 'mcp',
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(res.verifiedDossiers[0] ?? res, null, 2) }],
    };
  }

  if (name === 'compare_retrieval_relevance') {
    const parsed = orchestrator.parseLuxuryQuery(input.query);
    const anchor = searchService.resolveGeoAnchor(parsed);
    const { comparisons } = searchService.searchHybridWithRerank(parsed, anchor);
    return {
      content: [{ type: 'text', text: JSON.stringify(comparisons, null, 2) }],
    };
  }

  throw new Error(`Unknown MCP tool: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('EstateTruth MCP server fatal error:', err);
  process.exit(1);
});
