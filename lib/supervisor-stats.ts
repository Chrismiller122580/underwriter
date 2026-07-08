import type { ClaimRecord } from '@/lib/claims-store';
import {
  getClaimPortalStats,
  listClaims,
} from '@/lib/claims-store';
import { getTextModelId, getXaiApiKey } from '@/lib/ai-client';
import { getKnowledgeStats } from '@/lib/knowledge-store';
import { ensureSchema, getSql } from '@/lib/db';
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

async function getContractTypeBreakdown(): Promise<Record<string, number>> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT
      COALESCE(policy_information->>'contractType', 'unknown') AS contract_type,
      COUNT(*)::int AS count
    FROM claims
    GROUP BY contract_type
  `) as { contract_type: string; count: number }[];

  return rows.reduce(
    (acc, row) => {
      acc[row.contract_type] = row.count;
      return acc;
    },
    {} as Record<string, number>
  );
}

async function getAverageRiskScore(): Promise<number | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT AVG((ai_analysis->>'riskScore')::numeric) AS avg_risk
    FROM claims
    WHERE ai_analysis IS NOT NULL
      AND ai_analysis->>'riskScore' IS NOT NULL
  `) as { avg_risk: string | null }[];

  const avg = rows[0]?.avg_risk;
  if (avg == null) return null;
  return Math.round(Number(avg) * 10) / 10;
}

async function getAnalyzedClaimCount(): Promise<number> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT COUNT(*)::int AS count
    FROM claims
    WHERE ai_analysis IS NOT NULL
  `) as { count: number }[];

  return rows[0]?.count ?? 0;
}

export async function getSupervisorOverview(): Promise<SupervisorOverview> {
  const [stats, knowledge, byContractType, avgRiskScore, withAnalysis, recentPage] =
    await Promise.all([
      getClaimPortalStats(),
      getKnowledgeStats(),
      getContractTypeBreakdown(),
      getAverageRiskScore(),
      getAnalyzedClaimCount(),
      listClaims({ limit: 8 }),
    ]);

  return {
    ai: {
      enabled: Boolean(getXaiApiKey()),
      model: getTextModelId(),
      visionModel: process.env.AI_VISION_MODEL ?? process.env.AI_MODEL ?? 'grok-3',
    },
    claims: {
      total: stats.total,
      pending: stats.pending,
      underReview: stats.underReview,
      approved: stats.approved,
      denied: stats.denied,
      withAnalysis,
      needsInfo: stats.needsInfo,
      guidelineFlags: stats.guidelineFlags,
      avgRiskScore,
      highRisk: stats.highRisk,
      byContractType,
      recent: recentPage.claims.map(summarizeClaim),
    },
    knowledge,
  };
}

export function getContractReference() {
  return {
    prefixes: [
      { prefix: 'FWCPM', type: 'complete' as ContractType, coverage: 'Exclusionary + Mfr Extension' },
      { prefix: 'FWCP', type: 'complete' as ContractType, coverage: 'Exclusionary' },
      { prefix: 'FWDR', type: 'drive' as ContractType, coverage: 'Stated components' },
      { prefix: 'FWVL', type: 'vital' as ContractType, coverage: 'Stated components' },
      { prefix: 'FWCL', type: 'classic' as ContractType, coverage: 'Stated components' },
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