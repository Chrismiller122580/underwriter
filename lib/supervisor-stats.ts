import type { ClaimRecord } from '@/lib/claims-store';
import { listClaims } from '@/lib/claims-store';
import { getTextModelId, getXaiApiKey } from '@/lib/ai-client';
import { getKnowledgeStats } from '@/lib/knowledge-store';
import type { ContractType } from '@/lib/contracts/types';

export type SupervisorOverview = {
  ai: {
    enabled: boolean;
    model: string;
    visionModel: string;
  };
  claims: {
    total: number;
    pending: number;
    underReview: number;
    approved: number;
    denied: number;
    withAnalysis: number;
    needsInfo: number;
    guidelineFlags: number;
    avgRiskScore: number | null;
    highRisk: number;
    byContractType: Record<string, number>;
    recent: {
      id: string;
      name: string;
      status: string;
      contractType: string;
      amount: number;
      riskScore: number | null;
      recommendation: string | null;
      createdAt: string;
    }[];
  };
  knowledge: Awaited<ReturnType<typeof getKnowledgeStats>>;
};

function summarizeClaim(claim: ClaimRecord) {
  return {
    id: claim._id,
    name: claim.claimantInformation.name,
    status: claim.status,
    contractType: claim.policyInformation.contractType ?? 'unknown',
    amount: claim.claimDetails.amount,
    riskScore: claim.aiAnalysis?.riskScore ?? null,
    recommendation: claim.aiAnalysis?.recommendation ?? null,
    createdAt: claim.createdAt,
  };
}

export async function getSupervisorOverview(): Promise<SupervisorOverview> {
  const [claims, knowledge] = await Promise.all([
    listClaims(),
    getKnowledgeStats(),
  ]);

  const analyzed = claims.filter((claim) => claim.aiAnalysis);
  const riskScores = analyzed
    .map((claim) => claim.aiAnalysis?.riskScore)
    .filter((score): score is number => typeof score === 'number');

  const byContractType = claims.reduce(
    (acc, claim) => {
      const type = claim.policyInformation.contractType ?? 'unknown';
      acc[type] = (acc[type] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    ai: {
      enabled: Boolean(getXaiApiKey()),
      model: getTextModelId(),
      visionModel: process.env.AI_VISION_MODEL ?? process.env.AI_MODEL ?? 'grok-3',
    },
    claims: {
      total: claims.length,
      pending: claims.filter((claim) => claim.status === 'pending').length,
      underReview: claims.filter((claim) => claim.status === 'under_review').length,
      approved: claims.filter((claim) => claim.status === 'approved').length,
      denied: claims.filter((claim) => claim.status === 'denied').length,
      withAnalysis: analyzed.length,
      needsInfo: claims.filter(
        (claim) => (claim.aiAnalysis?.informationRequests?.length ?? 0) > 0
      ).length,
      guidelineFlags: claims.filter(
        (claim) => (claim.aiAnalysis?.guidelineConflicts?.length ?? 0) > 0
      ).length,
      avgRiskScore:
        riskScores.length > 0
          ? Math.round(
              (riskScores.reduce((sum, score) => sum + score, 0) / riskScores.length) *
                10
            ) / 10
          : null,
      highRisk: claims.filter((claim) => (claim.aiAnalysis?.riskScore ?? 0) >= 7)
        .length,
      byContractType,
      recent: claims.slice(0, 8).map(summarizeClaim),
    },
    knowledge,
  };
}

export function getContractReference() {
  return {
    prefixes: [
      { prefix: 'FWCPM', type: 'complete', coverage: 'Exclusionary + Mfr Extension' },
      { prefix: 'FWCP', type: 'complete', coverage: 'Exclusionary' },
      { prefix: 'FWDR', type: 'drive', coverage: 'Stated components' },
      { prefix: 'FWVL', type: 'vital', coverage: 'Stated components' },
      { prefix: 'FWCL', type: 'classic', coverage: 'Stated components' },
    ],
    waitingPeriods: [
      { types: ['classic'], days: 90, miles: 200 },
      { types: ['vital', 'drive', 'complete'], days: 30, miles: 1000 },
    ],
    documentTypes: [
      'Proof of Ownership',
      'Maintenance Records',
      'Prior Claims History',
      'Inspection Reports',
      'Service History',
    ],
  };
}