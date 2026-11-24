import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { MultiAgentOrchestratorService } from '../agents/multi-agent-orchestrator.service';

/**
 * Omnichannel Messaging Webhook Adapter (WhatsApp Cloud API + Instagram Graph API).
 * Lets HNI buyers text "Worli sea-facing 4BHK, no RERA litigation, quiet" on WhatsApp or IG DM
 * and receive grounded forensic property verdicts directly in chat!
 */
@Controller('api/messaging')
export class MessagingController {
  constructor(private readonly orchestrator: MultiAgentOrchestratorService) {}

  // Meta Webhook Challenge Verification (WhatsApp Cloud API & Instagram Graph API)
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string
  ) {
    const expected = process.env.META_VERIFY_TOKEN || 'estatetruth_verify_2026';
    if (mode === 'subscribe' && token === expected) {
      return challenge;
    }
    return { ok: false, error: 'Verification token mismatch' };
  }

  // Inbound WhatsApp / Instagram DM handler -> executes 5-Node LangGraph workflow & returns structured chat reply
  @Post('webhook')
  async handleInboundMessage(
    @Body()
    body: {
      channel?: 'whatsapp' | 'instagram';
      senderId?: string;
      text?: string;
    }
  ) {
    const channel = body.channel || 'whatsapp';
    const senderId = body.senderId || 'hni_whatsapp_user';
    const text = (body.text || '').trim();
    if (!text) return { ok: false, error: 'Empty message text' };

    const result = await this.orchestrator.runConciergeWorkflow({
      query: text,
      sessionId: `${channel}_${senderId}`,
      userId: senderId,
      channel,
    });

    const top = result.verifiedDossiers[0];
    const formattedReply = top
      ? `🏛️ *EstateTruth Verified Match*\n*${top.canonicalName}* (${top.microMarket})\n• Price: ₹${top.priceCroreInr} Cr ($${top.priceUsdMillions}M)\n• True RERA Carpet: ${top.trueCarpetSqFt} sq.ft. (vs ${top.brokerAdvertisedSqFt} advertised)\n• Forensic Score: ${top.truthScore}/100 · Litigations: ${top.activeReraLitigations}\n• Night Noise: ${top.ambientNoiseDbNight} dB\n\n⚠️ Filtered out ${result.rejectedTraps.length} broker traps.\nTrace ID: ${result.traceId}`
      : result.conciergeNarrative;

    return {
      ok: true,
      channel,
      senderId,
      replyText: formattedReply,
      traceId: result.traceId,
      faithfulnessScore: result.judgeVerdict.faithfulnessScore,
    };
  }
}
