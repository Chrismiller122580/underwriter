import { generateObject } from 'ai';
import { getTextModelId, getXaiProvider } from '@/lib/ai-client';
import type { ClaimRecord } from '@/lib/claims-store';
import { heuristicAnalysis } from '@/lib/ai-heuristic';
import { aiAnalysisSchema, type AiAnalysis } from '@/lib/ai-types';
import { logger } from '@/lib/logger';

function buildClaimContext(claim: ClaimRecord): string {
  return JSON.stringify(
    {
      policy: claim.policyInformation,
      vehicle: claim.vehicleInfo,
      claimant: claim.claimantInformation,
      incident: claim.incidentDetails,
      repair: claim.repairInformation,
      amount: claim.claimDetails.amount,
      documentCount: claim.claimDetails.documents?.length ?? 0,
      submittedAt: claim.createdAt,
    },
    null,
    2
  );
}

export async function analyzeClaimWithAi(claim: ClaimRecord): Promise<AiAnalysis> {
  const xai = getXaiProvider();

  if (!xai) {
    logger.warn('XAI_API_KEY not set, using heuristic analysis', {
      claimId: claim._id,
    });
    return heuristicAnalysis(claim);
  }

  const model = getTextModelId();

  try {
    const { object } = await generateObject({
      model: xai(model),
      schema: aiAnalysisSchema,
      system: `You are an expert vehicle warranty claims underwriter AI for FWCUT.
Analyze claims for validity, consistency, and fraud risk.
Be thorough but fair. Flag inconsistencies between policy dates, incident details, repair costs, and vehicle info.
Recommend "deny" only for clear policy violations or strong fraud signals.
Recommend "review" for ambiguous or elevated-risk claims.
Recommend "approve" for straightforward valid claims.`,
      prompt: `Analyze this warranty claim and provide structured underwriting intelligence:

${buildClaimContext(claim)}`,
    });

    return {
      ...object,
      analyzedAt: new Date().toISOString(),
      model,
    };
  } catch (error) {
    logger.error('AI analysis failed, falling back to heuristic', {
      claimId: claim._id,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return heuristicAnalysis(claim);
  }
}

export function combineDecisions(
  ruleDecision: 'approved' | 'denied' | 'pending',
  ai: AiAnalysis
): { decision: 'approved' | 'denied' | 'under_review'; reason: string } {
  if (ruleDecision === 'denied') {
    return {
      decision: 'denied',
      reason: `Rule check failed. AI risk score: ${ai.riskScore}/10. ${ai.reasoning}`,
    };
  }

  if (ai.recommendation === 'deny') {
    return {
      decision: 'denied',
      reason: `AI recommends denial (risk ${ai.riskScore}/10): ${ai.reasoning}`,
    };
  }

  if (ai.recommendation === 'review') {
    return {
      decision: 'under_review',
      reason: `AI flags for review (risk ${ai.riskScore}/10): ${ai.reasoning}`,
    };
  }

  return {
    decision: 'approved',
    reason: `AI approved (risk ${ai.riskScore}/10, ${ai.confidence}% confidence): ${ai.reasoning}`,
  };
}