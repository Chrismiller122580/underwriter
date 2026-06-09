import { generateObject } from 'ai';
import { getTextModelId, getXaiProvider } from '@/lib/ai-client';
import { buildContractContext } from '@/lib/contracts/registry';
import type { ClaimRecord } from '@/lib/claims-store';
import { heuristicAnalysis } from '@/lib/ai-heuristic';
import { aiAnalysisSchema, type AiAnalysis } from '@/lib/ai-types';
import { logger } from '@/lib/logger';
import { buildUnderwritingSystemPrompt } from '@/lib/underwriting-guidelines';

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
    logger.warn('GROK_API_KEY not set, using heuristic analysis', {
      claimId: claim._id,
    });
    return heuristicAnalysis(claim);
  }

  const model = getTextModelId();

  try {
    const contractType = claim.policyInformation.contractType ?? 'unknown';
    const contractVariant = claim.policyInformation.contractVariant ?? 'standard';

    const { object } = await generateObject({
      model: xai(model),
      schema: aiAnalysisSchema,
      system: buildUnderwritingSystemPrompt(contractType, contractVariant),
      prompt: `Analyze this warranty claim per Freedom Warranty underwriting guidelines.

Contract context:
${buildContractContext(contractType, contractVariant)}

Claim data:
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