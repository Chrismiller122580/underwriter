import { generateObject } from 'ai';
import { getTextModelId, getXaiProvider } from '@/lib/ai-client';
import { buildContractContext } from '@/lib/contracts/registry';
import type { ClaimRecord } from '@/lib/claims-store';
import { heuristicAnalysis } from '@/lib/ai-heuristic';
import { aiAnalysisSchema, type AiAnalysis } from '@/lib/ai-types';
import { logger } from '@/lib/logger';
import {
  FILE_FIELD_LABELS,
  FILE_FIELDS,
} from '@/lib/parse-claim-form';
import { buildUnderwritingSystemPrompt } from '@/lib/knowledge-prompt';
import {
  formatPolicyHistoryForPrompt,
  type PolicyHistoryContext,
} from '@/lib/policy-history';
import { checkAutoApproveGuardrails } from '@/lib/underwriting-guardrails';
import { evaluateComponentCoverage } from '@/lib/contracts/components';

export type AnalyzeClaimOptions = {
  policyHistory?: PolicyHistoryContext | null;
};

function buildDocumentStatus(claim: ClaimRecord) {
  const attached = claim.claimDetails.attachedDocuments ?? {};
  const provided = FILE_FIELDS.filter((field) => attached[field]).map(
    (field) => ({
      field,
      label: FILE_FIELD_LABELS[field],
      url: attached[field],
    })
  );
  const missing = FILE_FIELDS.filter((field) => !attached[field]).map(
    (field) => ({
      field,
      label: FILE_FIELD_LABELS[field],
    })
  );

  return { provided, missing, documentCount: provided.length };
}

function buildClaimContext(
  claim: ClaimRecord,
  policyHistory?: PolicyHistoryContext | null
): string {
  const documents = buildDocumentStatus(claim);
  const contractType = claim.policyInformation.contractType ?? 'unknown';
  const componentCoverage = evaluateComponentCoverage(
    contractType,
    claim.repairInformation.detailedRepairDescription,
    claim.incidentDetails.descriptionOfIncident
  );

  return JSON.stringify(
    {
      policy: claim.policyInformation,
      vehicle: claim.vehicleInfo,
      claimant: claim.claimantInformation,
      incident: claim.incidentDetails,
      repair: claim.repairInformation,
      amount: claim.claimDetails.amount,
      documents,
      submittedAt: claim.createdAt,
      componentCoverage: {
        status: componentCoverage.status,
        matchedLabel: componentCoverage.matchedLabel,
        flags: componentCoverage.flags,
      },
      policyHistory: formatPolicyHistoryForPrompt(policyHistory),
    },
    null,
    2
  );
}

export async function analyzeClaimWithAi(
  claim: ClaimRecord,
  options: AnalyzeClaimOptions = {}
): Promise<AiAnalysis> {
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
    const contractVariant =
      claim.policyInformation.contractVariant ?? 'standard';

    const systemPrompt = await buildUnderwritingSystemPrompt(
      contractType,
      contractVariant
    );

    const { object } = await generateObject({
      model: xai(model),
      schema: aiAnalysisSchema,
      system: systemPrompt,
      prompt: `Analyze this warranty claim per Freedom Warranty underwriting guidelines.

Contract context:
${buildContractContext(contractType, contractVariant)}

Claim data (includes component coverage pre-check and policy aggregate history when available):
${buildClaimContext(claim, options.policyHistory)}

Pay special attention to:
- Whether the component is covered for this contract type
- Aggregate limit of liability vs prior approved amounts on the same policy
- Prior similar repairs (possible re-claim of already replaced components)
- Missing information that should be requested rather than denied`,
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

  if (ruleDecision === 'pending') {
    return {
      decision: 'under_review',
      reason: `Contract rules require adjuster review. AI risk score: ${ai.riskScore}/10. ${ai.reasoning}`,
    };
  }

  if (ai.recommendation === 'deny') {
    return {
      decision: 'denied',
      reason: `AI recommends denial (risk ${ai.riskScore}/10): ${ai.reasoning}`,
    };
  }

  if (
    ai.informationRequests.length > 0 ||
    ai.guidelineConflicts.length > 0 ||
    ai.recommendation === 'review'
  ) {
    const parts = [
      `AI flags for review (risk ${ai.riskScore}/10): ${ai.reasoning}`,
    ];
    if (ai.informationRequests.length > 0) {
      parts.push(`Information needed: ${ai.informationRequests.join('; ')}`);
    }
    if (ai.guidelineConflicts.length > 0) {
      parts.push(`Guideline concerns: ${ai.guidelineConflicts.join('; ')}`);
    }
    return {
      decision: 'under_review',
      reason: parts.join(' '),
    };
  }

  // Rules passed + AI approve — apply auto-approve safety guardrails
  const guardrails = checkAutoApproveGuardrails(ai);
  if (!guardrails.allowed) {
    return {
      decision: 'under_review',
      reason: `Auto-approve blocked: ${guardrails.reasons.join(' · ')}. AI said: ${ai.reasoning}`,
    };
  }

  return {
    decision: 'approved',
    reason: `AI approved (risk ${ai.riskScore}/10, ${ai.confidence}% confidence): ${ai.reasoning}`,
  };
}
