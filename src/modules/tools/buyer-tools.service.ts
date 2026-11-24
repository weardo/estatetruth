import { Injectable } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface TrueCostInput {
  city: 'Mumbai' | 'Dubai';
  agreementPriceCroreInr: number; // for Mumbai in Cr; for Dubai in Cr equivalent or USD M
  advertisedSqFt: number;
  reraCarpetSqFt: number;
  isUnderConstruction: boolean;
  isNriTransaction: boolean;
}

export interface TrueCostBreakdown {
  city: 'Mumbai' | 'Dubai';
  basePriceCrore: number;
  stampDutyOrDldCrore: number;
  gstCrore: number;
  hiddenBuilderChargesCrore: number; // PLC + Club + 24mo Advance Maint + Legal/Infra
  totalAllInCrore: number;
  hiddenCostDeltaCrore: number;
  hiddenCostPct: number;
  carpetLoadingPct: number;
  nonUsableSqFt: number;
  moneyPaidForWallsAndLobbiesCrore: number;
  advertisedPricePerSqFtInr: number;
  trueCarpetPricePerSqFtInr: number;
  nriComplianceNote: string;
  lineItems: Array<{ label: string; amountCrore: number; note: string }>;
}

export interface AgreementRedFlag {
  severity: 'HIGH' | 'MEDIUM' | 'INFO';
  clauseTitle: string;
  riskSummary: string;
  legalBasis: string;
  recommendedCounterClause: string;
}

export interface AgreementScanResult {
  verdict: 'DO_NOT_SIGN_AS_IS' | 'NEGOTIATE_BEFORE_SIGNING' | 'GENERALLY_FAIR';
  riskScore: number; // 0-100 (higher = riskier)
  executiveSummary: string;
  redFlags: AgreementRedFlag[];
  modelUsed: string;
  liveLlmCalled: boolean;
  latencyMs: number;
}

/**
 * High-Intent Buyer Utility Engine built directly around top Google Searches:
 * 1. "how to check hidden charges in property purchase" & "how to calculate carpet area as per RERA Mumbai"
 * 2. "what to check in builder-buyer agreement before signing" & "Dubai DLD escrow verification"
 * 3. "NRI property purchase TDS / FEMA repatriation rules"
 */
@Injectable()
export class BuyerToolsService {
  private readonly client: GoogleGenAI | null = null;

  constructor() {
    const key = this.resolveApiKey();
    if (key && process.env.SKIP_LIVE_LLM !== '1') {
      this.client = new GoogleGenAI({ apiKey: key });
    }
  }

  private resolveApiKey(): string | null {
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
    if (process.env.GOOGLE_API_KEY) return process.env.GOOGLE_API_KEY.trim();
    try {
      const cfgPath = path.join(os.homedir(), '.config', 'gemini-api', 'config.yaml');
      if (fs.existsSync(cfgPath)) {
        const raw = fs.readFileSync(cfgPath, 'utf-8');
        const match = raw.match(/api_key:\s*["']?([^\s"']+)["']?/i);
        if (match?.[1]) return match[1].trim();
      }
    } catch {
      // ignore
    }
    return null;
  }

  /**
   * Tool 1: Exact Mumbai (MahaRERA) & Dubai (DLD) True All-In Cost & Carpet Loading X-Ray.
   */
  calculateTrueCost(input: TrueCostInput): TrueCostBreakdown {
    const base = Math.max(0.5, Number(input.agreementPriceCroreInr) || 25);
    const advSqFt = Math.max(200, Number(input.advertisedSqFt) || 3500);
    const carpetSqFt = Math.min(advSqFt, Math.max(150, Number(input.reraCarpetSqFt) || 2400));

    const isMumbai = input.city === 'Mumbai';
    // Mumbai: 6% Stamp Duty (5% + 1% Metro Cess) + ₹30k Reg; Dubai: 4% DLD Transfer Fee + Trustee/Oqood
    const stampRate = isMumbai ? 0.06 : 0.04;
    const stampDutyOrDldCrore = Number((base * stampRate).toFixed(2));

    // GST: 5% in India if under-construction (no OC); 0% if OC received or Dubai residential
    const gstCrore = isMumbai && input.isUnderConstruction ? Number((base * 0.05).toFixed(2)) : 0;

    // Typical Luxury Hidden Builder Add-ons: Floor Rise / PLC + Clubhouse + 24m Advance Maint + Legal/Infra (~4.2% Mumbai, ~2.2% Dubai)
    const hiddenRate = isMumbai ? 0.042 : 0.022;
    const hiddenBuilderChargesCrore = Number((base * hiddenRate).toFixed(2));

    const totalAllInCrore = Number((base + stampDutyOrDldCrore + gstCrore + hiddenBuilderChargesCrore).toFixed(2));
    const hiddenCostDeltaCrore = Number((totalAllInCrore - base).toFixed(2));
    const hiddenCostPct = Number(((hiddenCostDeltaCrore / base) * 100).toFixed(1));

    const nonUsableSqFt = advSqFt - carpetSqFt;
    const carpetLoadingPct = Number(((nonUsableSqFt / carpetSqFt) * 100).toFixed(1));
    const moneyPaidForWallsAndLobbiesCrore = Number(((nonUsableSqFt / advSqFt) * base).toFixed(2));

    const baseInr = base * 10_000_000;
    const advertisedPricePerSqFtInr = Math.round(baseInr / advSqFt);
    const trueCarpetPricePerSqFtInr = Math.round((totalAllInCrore * 10_000_000) / carpetSqFt);

    const nriComplianceNote = input.isNriTransaction
      ? isMumbai
        ? 'NRI Alert (FEMA / Sec 195): Purchasing from an NRI seller requires 12.5% LTCG + surcharge TDS (apply for Form 13 Lower Deduction Certificate to avoid paying on full sale value). Outward repatriation capped at USD $1M/financial year via NRO after Form 15CA/15CB.'
        : 'NRI / Foreign Buyer Dubai Alert: Transfer funds strictly to the DLD-registered project Escrow IBAN (verify on Dubai REST app). Never wire booking deposits to a broker or developer personal account.'
      : isMumbai
        ? 'Resident Buyer Note: Deduct 1% TDS under Section 194-IA (Form 26QB) on properties above ₹50 Lakh. Demand RERA Carpet Area explicitly in the registered Agreement for Sale.'
        : 'Dubai Buyer Note: Verify Trakheesi ad permit and Oqood registration before releasing the 10%–20% booking tranche.';

    const lineItems = [
      { label: 'Quoted Agreement Price', amountCrore: base, note: 'Headline developer / broker quote' },
      {
        label: isMumbai ? 'Maharashtra Stamp Duty (6% incl. Metro Cess)' : 'Dubai Land Dept (DLD) Transfer Fee (4%)',
        amountCrore: stampDutyOrDldCrore,
        note: isMumbai ? '5% base + 1% Mumbai Metro cess' : 'Mandatory DLD title/Oqood registration',
      },
      ...(gstCrore > 0
        ? [
            {
              label: 'GST on Under-Construction Property (5%)',
              amountCrore: gstCrore,
              note: 'Saved completely if Occupation Certificate (OC) is already received',
            },
          ]
        : []),
      {
        label: 'Hidden Add-Ons (PLC, Club, 24-Mo Maint, Legal/Infra)',
        amountCrore: hiddenBuilderChargesCrore,
        note: isMumbai ? 'Often omitted from initial WhatsApp cost sheets' : 'Admin, NOC, & advance service charges',
      },
    ];

    return {
      city: input.city,
      basePriceCrore: base,
      stampDutyOrDldCrore,
      gstCrore,
      hiddenBuilderChargesCrore,
      totalAllInCrore,
      hiddenCostDeltaCrore,
      hiddenCostPct,
      carpetLoadingPct,
      nonUsableSqFt,
      moneyPaidForWallsAndLobbiesCrore,
      advertisedPricePerSqFtInr,
      trueCarpetPricePerSqFtInr,
      nriComplianceNote,
      lineItems,
    };
  }

  /**
   * Tool 2: Live Gemini 4 Builder-Buyer Agreement & Broker Pitch Red-Flag Scanner.
   * Catches illegal forfeiture, super-built-up pricing, personal-account escrow bypass, and unilateral delay clauses.
   */
  async scanAgreementOrPitch(text: string, city: 'Mumbai' | 'Dubai' = 'Mumbai'): Promise<AgreementScanResult> {
    const t0 = Date.now();
    const raw = (text || '').trim();
    const lower = raw.toLowerCase();

    // Deterministic legal guardrail detection (always runs as fast baseline + fallback!)
    const deterministicFlags: AgreementRedFlag[] = [];
    if (
      /(forfeit|forfeiture|non-refundable|non refundable).{0,60}(\d{1,2}%|booking|earnest)/i.test(lower) ||
      /(\d{1,2}%).{0,60}(forfeit|deduct|forfeited)/i.test(lower)
    ) {
      deterministicFlags.push({
        severity: 'HIGH',
        clauseTitle: 'Predatory Cancellation Forfeiture Clause',
        riskSummary:
          'Developer attempts to forfeit 10%–20% of total consideration on cancellation. MahaRERA & NCDRC tribunals have repeatedly capped reasonable booking forfeiture far lower (typically 2% or actual proved loss) when no formal agreement is executed.',
        legalBasis: 'MahaRERA Model Allotment Letter Guidelines & Supreme Court Pioneer Urban ruling',
        recommendedCounterClause:
          'Request replacement with: "In the event of buyer cancellation prior to registration, forfeiture shall not exceed 2% of the booking token, with the balance refunded within 30 days."',
      });
    }
    if (/(super built[- ]?up|saleable area|chargeable area)/i.test(lower)) {
      deterministicFlags.push({
        severity: 'HIGH',
        clauseTitle: 'Unlawful Super Built-Up / Saleable Area Pricing',
        riskSummary:
          'Marketing or billing on "Super Built-Up" or "Saleable Area" masks 35%–55% loading for lobbies, staircases, and shafts.',
        legalBasis: 'RERA Act 2016 Section 2(k) & Section 14 — All sales must strictly state Net RERA Carpet Area',
        recommendedCounterClause:
          'Demand written annexure: "Total Consideration is strictly linked to verified RERA Carpet Area of [X] sq.ft. Any downward deviation >3% triggers pro-rata price reduction."',
      });
    }
    if (/(personal account|cash|direct to broker|non-escrow|director'?s account)/i.test(lower)) {
      deterministicFlags.push({
        severity: 'HIGH',
        clauseTitle: 'Escrow Account Bypass / Fraud Alert',
        riskSummary:
          'Requesting payments outside the registered RERA / DLD Escrow Account exposes 100% of your capital to diversion or total loss.',
        legalBasis:
          city === 'Dubai'
            ? 'Dubai Law No. 8 of 2007 (Escrow Accounts for Real Estate Development)'
            : 'RERA Section 4(2)(l)(D) — Mandatory 70% Separate Designated Escrow Account',
        recommendedCounterClause:
          'Refuse immediately. Wire payments ONLY to the official RERA / DLD-verified Escrow IBAN matching the registered project entity.',
      });
    }
    if (/(reasonable extension|force majeure|unilateral|sole discretion|tentative date|grace period)/i.test(lower)) {
      deterministicFlags.push({
        severity: 'MEDIUM',
        clauseTitle: 'One-Sided Possession Delay & Grace Period Loophole',
        riskSummary:
          'Open-ended "tentative" dates or broad developer-discretion grace periods strip buyers of statutory delay interest.',
        legalBasis: 'RERA Section 18(1) — Mandatory SBI MCLR + 2% monthly interest for every month of delay',
        recommendedCounterClause:
          'Insert fixed date: "Possession with full Occupation Certificate (OC) shall be delivered on or before [DD/MM/YYYY], failing which statutory interest under RERA Section 18 applies automatically."',
      });
    }
    if (/(assured return|guaranteed rental|12% return|pre-emi)/i.test(lower)) {
      deterministicFlags.push({
        severity: 'HIGH',
        clauseTitle: 'Unregulated Assured-Return / Pre-EMI Scheme Risk',
        riskSummary:
          'Guaranteed return schemes frequently inflate base property price by 20–30% to pay back your own money and often default before possession.',
        legalBasis: 'SEBI / Banning of Unregulated Deposit Schemes Act (BUDS) & RERA Advisory',
        recommendedCounterClause:
          'Decline assured-return markups and negotiate an upfront clean discount on the base RERA carpet price instead.',
      });
    }

    if (deterministicFlags.length === 0) {
      deterministicFlags.push({
        severity: 'INFO',
        clauseTitle: 'Verify Annexures & Sanctioned OC Status',
        riskSummary:
          'No obvious predatory forfeiture or escrow bypass keywords detected in this short excerpt, but always cross-check the registered MahaRERA/DLD number, CA Form 3 escrow status, and exact RERA Carpet schedule.',
        legalBasis: 'Standard HNI Conveyancing Protocol',
        recommendedCounterClause:
          'Request the latest MahaRERA Quarterly Progress Report (QPR) or DLD REST project status screenshot before releasing the booking cheque.',
      });
    }

    // Upgrade analysis with LIVE Gemini Interactions API structured JSON output (bounded 6s circuit breaker)
    if (this.client && process.env.SKIP_LIVE_LLM !== '1') {
      const modelsToTry = ['gemini-4-hydrogen'];
      for (const modelName of modelsToTry) {
        try {
          const response = await Promise.race([
            this.client.interactions.create({
              model: modelName,
              input: `Audit this ${city} real estate broker pitch or builder-buyer agreement excerpt for an HNI buyer. Identify concrete legal, financial, carpet-area, escrow, or delay red flags and provide exact counter-clauses.

Return ONLY valid raw JSON (no markdown fences) matching this exact shape:
{
  "verdict": "DO_NOT_SIGN_AS_IS" | "NEGOTIATE_BEFORE_SIGNING" | "GENERALLY_FAIR",
  "riskScore": 0-100,
  "executiveSummary": "2-sentence blunt buyer-side verdict",
  "redFlags": [
    {
      "severity": "HIGH" | "MEDIUM" | "INFO",
      "clauseTitle": "Short title",
      "riskSummary": "Why this harms the buyer",
      "legalBasis": "Exact MahaRERA / RERA Act 2016 / Dubai Law No. 8 / DLD citation",
      "recommendedCounterClause": "Exact replacement sentence the buyer should demand"
    }
  ]
}

Excerpt:
"""
${raw.slice(0, 3500)}
"""`,
              system_instruction:
                'You are a ruthless, buyer-only luxury real estate legal & forensic auditor specializing in Mumbai MahaRERA and Dubai DLD regulations. Output strictly valid raw JSON only.',
              store: false,
            }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('LLM timeout')), 6000)),
          ]);

          const rawText = (
            response.output_text ||
            ((response as unknown as { outputs?: Array<{ text?: string }> }).outputs || [])
              .map((o) => o.text || '')
              .join('')
          )
            .trim()
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/```$/i, '')
            .trim();

          const jsonStart = rawText.indexOf('{');
          const jsonEnd = rawText.lastIndexOf('}');
          const jsonSlice = jsonStart >= 0 && jsonEnd > jsonStart ? rawText.slice(jsonStart, jsonEnd + 1) : rawText;

          const parsed = JSON.parse(jsonSlice || '{}') as Partial<AgreementScanResult>;
          if (parsed.executiveSummary && Array.isArray(parsed.redFlags) && parsed.redFlags.length > 0) {
            return {
              verdict: parsed.verdict || 'NEGOTIATE_BEFORE_SIGNING',
              riskScore: Math.max(5, Math.min(99, Math.round(Number(parsed.riskScore || 70)))),
              executiveSummary: parsed.executiveSummary,
              redFlags: parsed.redFlags,
              modelUsed: modelName,
              liveLlmCalled: true,
              latencyMs: Date.now() - t0,
            };
          }
        } catch (err) {
          console.warn(`[BuyerToolsService] ${modelName} scan failed:`, (err as Error).message);
        }
      }
    }

    const highCount = deterministicFlags.filter((f) => f.severity === 'HIGH').length;
    const medCount = deterministicFlags.filter((f) => f.severity === 'MEDIUM').length;
    const riskScore = Math.min(96, highCount * 34 + medCount * 18 + 14);
    const verdict: AgreementScanResult['verdict'] =
      highCount >= 1 ? 'DO_NOT_SIGN_AS_IS' : medCount >= 1 ? 'NEGOTIATE_BEFORE_SIGNING' : 'GENERALLY_FAIR';

    return {
      verdict,
      riskScore,
      executiveSummary:
        highCount > 0
          ? `Caught ${highCount} high-severity predatory clause(s) that shift disproportionate financial or legal risk onto you. Do not wire booking funds until amended in writing.`
          : medCount > 0
            ? `Detected ${medCount} ambiguous timeline/terms clause(s) that should be tightened before execution.`
            : 'No obvious predatory clauses detected in this excerpt; verify RERA/DLD escrow registration and carpet schedule before payment.',
      redFlags: deterministicFlags,
      modelUsed: 'legal-guardrail-fallback',
      liveLlmCalled: false,
      latencyMs: Date.now() - t0,
    };
  }
}
