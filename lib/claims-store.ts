import { ensureSchema, getSql } from '@/lib/db';
import type { ParsedClaimForm } from '@/lib/parse-claim-form';
import { buildClaimDocument } from '@/lib/parse-claim-form';
import { shouldReuseAiAnalysis } from '@/lib/ai-analysis-cache';
import {
  analyzeClaimWithAi,
  combineDecisions,
} from '@/lib/ai-underwrite';
import type { AiAnalysis } from '@/lib/ai-types';
import {
  evaluateContractRules,
  type ContractRuleResult,
} from '@/lib/contract-rules';
import type { ContractTypeOrUnknown, ContractVariant } from '@/lib/contracts/types';
import {
  buildPolicyHistoryContext,
  toRelatedClaimSummary,
  type PolicyHistoryContext,
} from '@/lib/policy-history';
import { safeAppendClaimEvent } from '@/lib/claim-events';
import {
  buildInfoRequest,
  type InfoRequestRecord,
} from '@/lib/info-request';
import type { UnderwritingResult } from '@/lib/underwrite';

export type ClaimRecord = {
  _id: string;
  policyInformation: {
    policyNumber: string;
    contractType?: ContractTypeOrUnknown;
    contractVariant?: ContractVariant;
    contractTypeSource?: 'policy_number' | 'filename' | 'ai' | 'manual';
    coverageDetails: string;
    policyEffectiveDate: string;
    policyExpirationDate: string;
  };
  vehicleInfo: {
    make: string;
    model: string;
    year: number;
    vin: string;
    odometerReading: number;
    odometerAtEffective?: number;
  };
  claimantInformation: {
    name: string;
    contactInformation: string;
    relationshipToVehicle: string;
  };
  incidentDetails: {
    dateOfLoss: string;
    descriptionOfIncident: string;
    locationOfIncident: string;
  };
  repairInformation: {
    repairEstimate: number;
    detailedRepairDescription: string;
    repairShopInformation: string;
  };
  claimDetails: {
    description: string;
    amount: number;
    documents: string[];
    attachedDocuments?: Record<string, string>;
  };
  status: string;
  underwriting?: {
    decision?: string;
    reason?: string;
    reviewedAt?: string;
    source?: 'ai' | 'manual' | 'rules';
    decidedBy?: string;
    decidedByRole?: string;
  };
  aiAnalysis?: AiAnalysis;
  infoRequest?: InfoRequestRecord;
  /** Public tracking code for claimant status portal (not the UUID). */
  publicToken?: string;
  createdAt: string;
  updatedAt: string;
};

type ClaimRow = {
  id: string;
  policy_information: ClaimRecord['policyInformation'];
  vehicle_info: ClaimRecord['vehicleInfo'];
  claimant_information: ClaimRecord['claimantInformation'];
  incident_details: ClaimRecord['incidentDetails'];
  repair_information: ClaimRecord['repairInformation'];
  claim_details: ClaimRecord['claimDetails'];
  status: string;
  underwriting: ClaimRecord['underwriting'] | null;
  ai_analysis: AiAnalysis | null;
  info_request?: InfoRequestRecord | null;
  public_token?: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: ClaimRow): ClaimRecord {
  return {
    _id: row.id,
    policyInformation: row.policy_information,
    vehicleInfo: row.vehicle_info,
    claimantInformation: row.claimant_information,
    incidentDetails: row.incident_details,
    repairInformation: row.repair_information,
    claimDetails: row.claim_details,
    status: row.status,
    underwriting: row.underwriting ?? undefined,
    aiAnalysis: row.ai_analysis ?? undefined,
    infoRequest: row.info_request ?? undefined,
    publicToken: row.public_token ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function generatePublicToken(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';
  for (let i = 0; i < 10; i++) {
    token += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return token;
}

export type ClaimPortalStats = {
  total: number;
  pending: number;
  underReview: number;
  approved: number;
  denied: number;
  needsInfo: number;
  guidelineFlags: number;
  noAi: number;
  highRisk: number;
  actionQueue: number;
};

export type ListClaimsResult = {
  claims: ClaimRecord[];
  nextCursor: string | null;
};

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`).toString('base64url');
}

function decodeCursor(cursor: string): [string, string] {
  const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  const [createdAt, id] = decoded.split('|');
  if (!createdAt || !id) {
    throw new Error('Invalid pagination cursor');
  }
  return [createdAt, id];
}

export async function listClaims(options?: {
  limit?: number;
  cursor?: string;
}): Promise<ListClaimsResult> {
  await ensureSchema();
  const sql = getSql();
  const limit = Math.min(
    Math.max(options?.limit ?? DEFAULT_LIST_LIMIT, 1),
    MAX_LIST_LIMIT
  );

  let rows: ClaimRow[];

  if (options?.cursor) {
    const [cursorCreatedAt, cursorId] = decodeCursor(options.cursor);
    rows = (await sql`
      SELECT * FROM claims
      WHERE (created_at, id) < (${cursorCreatedAt}::timestamptz, ${cursorId}::uuid)
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit + 1}
    `) as ClaimRow[];
  } else {
    rows = (await sql`
      SELECT * FROM claims
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit + 1}
    `) as ClaimRow[];
  }

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  return {
    claims: page.map(mapRow),
    nextCursor:
      hasMore && last
        ? encodeCursor(new Date(last.created_at).toISOString(), last.id)
        : null,
  };
}

export async function getClaimPortalStats(): Promise<ClaimPortalStats> {
  await ensureSchema();
  const sql = getSql();

  const rows = (await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE status = 'under_review')::int AS under_review,
      COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
      COUNT(*) FILTER (WHERE status = 'denied')::int AS denied,
      COUNT(*) FILTER (
        WHERE status = 'needs_info'
          OR info_request IS NOT NULL
          OR COALESCE(jsonb_array_length(ai_analysis->'informationRequests'), 0) > 0
      )::int AS needs_info,
      COUNT(*) FILTER (
        WHERE COALESCE(jsonb_array_length(ai_analysis->'guidelineConflicts'), 0) > 0
      )::int AS guideline_flags,
      COUNT(*) FILTER (WHERE ai_analysis IS NULL)::int AS no_ai,
      COUNT(*) FILTER (
        WHERE COALESCE((ai_analysis->>'riskScore')::numeric, 0) >= 7
      )::int AS high_risk,
      COUNT(*) FILTER (
        WHERE status IN ('pending', 'under_review', 'needs_info')
          OR ai_analysis IS NULL
          OR info_request IS NOT NULL
          OR COALESCE(jsonb_array_length(ai_analysis->'informationRequests'), 0) > 0
          OR COALESCE(jsonb_array_length(ai_analysis->'guidelineConflicts'), 0) > 0
      )::int AS action_queue
    FROM claims
  `) as {
    total: number;
    pending: number;
    under_review: number;
    approved: number;
    denied: number;
    needs_info: number;
    guideline_flags: number;
    no_ai: number;
    high_risk: number;
    action_queue: number;
  }[];

  const row = rows[0];
  return {
    total: row.total,
    pending: row.pending,
    underReview: row.under_review,
    approved: row.approved,
    denied: row.denied,
    needsInfo: row.needs_info,
    guidelineFlags: row.guideline_flags,
    noAi: row.no_ai,
    highRisk: row.high_risk,
    actionQueue: row.action_queue,
  };
}

export async function listClaimsForScope(
  scope: 'pending' | 'under_review' | 'unanalyzed' | 'all',
  limit: number
): Promise<ClaimRecord[]> {
  await ensureSchema();
  const sql = getSql();
  const cappedLimit = Math.min(Math.max(limit, 1), 25);

  let rows: ClaimRow[];

  if (scope === 'pending') {
    rows = (await sql`
      SELECT * FROM claims
      WHERE status = 'pending'
      ORDER BY created_at DESC
      LIMIT ${cappedLimit}
    `) as ClaimRow[];
  } else if (scope === 'under_review') {
    rows = (await sql`
      SELECT * FROM claims
      WHERE status = 'under_review'
      ORDER BY created_at DESC
      LIMIT ${cappedLimit}
    `) as ClaimRow[];
  } else if (scope === 'unanalyzed') {
    rows = (await sql`
      SELECT * FROM claims
      WHERE ai_analysis IS NULL
      ORDER BY created_at DESC
      LIMIT ${cappedLimit}
    `) as ClaimRow[];
  } else {
    rows = (await sql`
      SELECT * FROM claims
      ORDER BY created_at DESC
      LIMIT ${cappedLimit}
    `) as ClaimRow[];
  }

  return rows.map(mapRow);
}

export async function createClaim(
  parsed: ParsedClaimForm,
  documentPaths: Record<string, string>
): Promise<ClaimRecord> {
  await ensureSchema();
  const sql = getSql();
  const doc = buildClaimDocument(parsed, documentPaths);
  const publicToken = generatePublicToken();

  const rows = (await sql`
    INSERT INTO claims (
      policy_information, vehicle_info, claimant_information,
      incident_details, repair_information, claim_details, status,
      public_token
    ) VALUES (
      ${JSON.stringify(doc.policyInformation)}::jsonb,
      ${JSON.stringify(doc.vehicleInfo)}::jsonb,
      ${JSON.stringify(doc.claimantInformation)}::jsonb,
      ${JSON.stringify(doc.incidentDetails)}::jsonb,
      ${JSON.stringify(doc.repairInformation)}::jsonb,
      ${JSON.stringify(doc.claimDetails)}::jsonb,
      ${doc.status},
      ${publicToken}
    )
    RETURNING *
  `) as ClaimRow[];

  const created = mapRow(rows[0]);
  await safeAppendClaimEvent({
    claimId: created._id,
    eventType: 'submitted',
    summary: `Claim submitted for ${created.claimantInformation.name} · $${created.claimDetails.amount.toLocaleString()} · tracking ${publicToken}`,
    toStatus: created.status,
    detail: {
      policyNumber: created.policyInformation.policyNumber,
      contractType: created.policyInformation.contractType,
      publicToken,
    },
  });
  return created;
}

export async function findClaimByPublicToken(
  trackingCode: string
): Promise<ClaimRecord | null> {
  await ensureSchema();
  const sql = getSql();
  const code = trackingCode.trim().toUpperCase();
  if (!code) return null;

  const rows = (await sql`
    SELECT * FROM claims
    WHERE upper(public_token) = ${code}
    LIMIT 1
  `) as ClaimRow[];

  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}

export async function updateClaimDocuments(
  id: string,
  documentPaths: Record<string, string>
): Promise<ClaimRecord> {
  await ensureSchema();
  const sql = getSql();
  const documents = JSON.stringify(Object.values(documentPaths));
  const attachedDocuments = JSON.stringify(documentPaths);

  const rows = (await sql`
    UPDATE claims
    SET claim_details = jsonb_set(
          jsonb_set(claim_details, '{documents}', ${documents}::jsonb),
          '{attachedDocuments}',
          ${attachedDocuments}::jsonb
        ),
        updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING *
  `) as ClaimRow[];

  return mapRow(rows[0]);
}

export async function saveAiAnalysis(
  id: string,
  analysis: AiAnalysis
): Promise<ClaimRecord> {
  await ensureSchema();
  const sql = getSql();

  const rows = (await sql`
    UPDATE claims
    SET ai_analysis = ${JSON.stringify(analysis)}::jsonb,
        updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING *
  `) as ClaimRow[];

  return mapRow(rows[0]);
}

export async function getClaimById(id: string): Promise<ClaimRecord | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM claims WHERE id = ${id}::uuid
  `) as ClaimRow[];

  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}

/**
 * Load peer claims on the same policy number (case-insensitive),
 * optionally excluding the claim currently being underwritten.
 */
export async function listClaimsByPolicyNumber(
  policyNumber: string,
  options: { excludeClaimId?: string; limit?: number } = {}
): Promise<ClaimRecord[]> {
  await ensureSchema();
  const sql = getSql();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const normalized = policyNumber.trim();
  if (!normalized) return [];

  let rows: ClaimRow[];

  if (options.excludeClaimId) {
    rows = (await sql`
      SELECT * FROM claims
      WHERE lower(policy_information->>'policyNumber') = lower(${normalized})
        AND id <> ${options.excludeClaimId}::uuid
      ORDER BY created_at DESC
      LIMIT ${limit}
    `) as ClaimRow[];
  } else {
    rows = (await sql`
      SELECT * FROM claims
      WHERE lower(policy_information->>'policyNumber') = lower(${normalized})
      ORDER BY created_at DESC
      LIMIT ${limit}
    `) as ClaimRow[];
  }

  return rows.map(mapRow);
}

export async function getPolicyHistoryForClaim(
  claim: ClaimRecord
): Promise<PolicyHistoryContext> {
  const peers = await listClaimsByPolicyNumber(
    claim.policyInformation.policyNumber,
    { excludeClaimId: claim._id }
  );

  return buildPolicyHistoryContext(
    claim.policyInformation.policyNumber,
    claim.policyInformation.contractType,
    claim.repairInformation.repairEstimate,
    peers.map(toRelatedClaimSummary)
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidClaimId(id: string): boolean {
  return UUID_RE.test(id);
}

export type AiAnalysisOptions = {
  force?: boolean;
  actorEmail?: string;
  actorRole?: string;
};

async function resolveAiAnalysis(
  claim: ClaimRecord,
  options: AiAnalysisOptions = {},
  policyHistory?: PolicyHistoryContext | null
): Promise<AiAnalysis> {
  if (shouldReuseAiAnalysis(claim.aiAnalysis, options.force)) {
    return claim.aiAnalysis;
  }
  return analyzeClaimWithAi(claim, { policyHistory });
}

export async function runAiAnalysis(
  id: string,
  options: AiAnalysisOptions = {}
): Promise<{ claim: ClaimRecord; analysis: AiAnalysis; reused: boolean } | null> {
  const claim = await getClaimById(id);
  if (!claim) return null;

  if (shouldReuseAiAnalysis(claim.aiAnalysis, options.force)) {
    return { claim, analysis: claim.aiAnalysis, reused: true };
  }

  const policyHistory = await getPolicyHistoryForClaim(claim);
  const analysis = await analyzeClaimWithAi(claim, { policyHistory });
  const updated = await saveAiAnalysis(id, analysis);

  await safeAppendClaimEvent({
    claimId: id,
    eventType: 'analyzed',
    summary: `AI analysis · risk ${analysis.riskScore}/10 · ${analysis.recommendation}`,
    fromStatus: claim.status,
    toStatus: updated.status,
    detail: {
      riskScore: analysis.riskScore,
      recommendation: analysis.recommendation,
      confidence: analysis.confidence,
      model: analysis.model,
    },
  });

  return { claim: updated, analysis, reused: false };
}

const UNDERWRITABLE_STATUSES = new Set([
  'pending',
  'under_review',
  'needs_info',
]);

export async function requestInfoOnClaim(
  id: string,
  input: {
    items: string[];
    note?: string;
    requestedBy?: string;
    source?: InfoRequestRecord['source'];
  }
): Promise<ClaimRecord | null> {
  const claim = await getClaimById(id);
  if (!claim) return null;

  if (!UNDERWRITABLE_STATUSES.has(claim.status) && claim.status !== 'needs_info') {
    throw new ClaimNotUnderwritableError(claim);
  }

  const infoRequest = buildInfoRequest(input);
  const fromStatus = claim.status;
  const sql = getSql();
  const rows = (await sql`
    UPDATE claims
    SET status = 'needs_info',
        info_request = ${JSON.stringify(infoRequest)}::jsonb,
        updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING *
  `) as ClaimRow[];

  const updated = mapRow(rows[0]);
  await safeAppendClaimEvent({
    claimId: id,
    eventType: 'info_requested',
    summary: `Info requested (${infoRequest.items.length} item${infoRequest.items.length === 1 ? '' : 's'})`,
    actorEmail: input.requestedBy,
    fromStatus,
    toStatus: 'needs_info',
    detail: { items: infoRequest.items, note: infoRequest.note },
  });
  return updated;
}

export async function clearInfoRequestOnClaim(
  id: string,
  actor?: { email?: string; role?: string }
): Promise<ClaimRecord | null> {
  const claim = await getClaimById(id);
  if (!claim) return null;

  const nextStatus =
    claim.status === 'needs_info' ? 'under_review' : claim.status;

  const sql = getSql();
  const rows = (await sql`
    UPDATE claims
    SET status = ${nextStatus},
        info_request = NULL,
        updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING *
  `) as ClaimRow[];

  const updated = mapRow(rows[0]);
  await safeAppendClaimEvent({
    claimId: id,
    eventType: 'info_cleared',
    summary: 'Information request cleared — ready for continued underwriting',
    actorEmail: actor?.email,
    actorRole: actor?.role,
    fromStatus: claim.status,
    toStatus: nextStatus,
  });
  return updated;
}

export type ManualDecisionInput = {
  decision: 'approved' | 'denied' | 'under_review';
  reason: string;
  decidedBy: string;
  decidedByRole: string;
};

export async function manualDecisionOnClaim(
  id: string,
  input: ManualDecisionInput
): Promise<ClaimRecord | null> {
  const claim = await getClaimById(id);
  if (!claim) return null;

  const reason = input.reason.trim();
  if (reason.length < 10) {
    throw new Error('Manual decision reason must be at least 10 characters');
  }

  const underwriting = {
    decision:
      input.decision === 'under_review' ? 'pending' : input.decision,
    reason: reason.slice(0, 2000),
    reviewedAt: new Date().toISOString(),
    source: 'manual' as const,
    decidedBy: input.decidedBy,
    decidedByRole: input.decidedByRole,
  };

  const sql = getSql();
  const clearInfo =
    input.decision === 'approved' || input.decision === 'denied';

  const rows = (
    clearInfo
      ? await sql`
          UPDATE claims
          SET status = ${input.decision},
              underwriting = ${JSON.stringify(underwriting)}::jsonb,
              info_request = NULL,
              updated_at = NOW()
          WHERE id = ${id}::uuid
          RETURNING *
        `
      : await sql`
          UPDATE claims
          SET status = ${input.decision},
              underwriting = ${JSON.stringify(underwriting)}::jsonb,
              updated_at = NOW()
          WHERE id = ${id}::uuid
          RETURNING *
        `
  ) as ClaimRow[];

  const updated = mapRow(rows[0]);
  await safeAppendClaimEvent({
    claimId: id,
    eventType: 'manual_decision',
    summary: `Manual ${input.decision.replace('_', ' ')}: ${reason.slice(0, 160)}`,
    actorEmail: input.decidedBy,
    actorRole: input.decidedByRole,
    fromStatus: claim.status,
    toStatus: input.decision,
    detail: {
      source: 'manual',
      reason,
      previousUnderwriting: claim.underwriting ?? null,
    },
  });

  // Optional FWIS decision sync (no-op unless FWIS_PUSH_DECISIONS=true)
  try {
    const { getFwisConfig, pushFwisDecision } = await import('@/lib/fwis');
    if (getFwisConfig().pushDecisions) {
      await pushFwisDecision({
        localClaimId: id,
        trackingCode: updated.publicToken,
        decision: input.decision,
        reason,
        source: 'manual',
        decidedBy: input.decidedBy,
        decidedAt: underwriting.reviewedAt,
      });
    }
  } catch {
    // Never block local decision on FWIS outage
  }

  return updated;
}

export class ClaimNotUnderwritableError extends Error {
  readonly claim: ClaimRecord;

  constructor(claim: ClaimRecord) {
    super(
      `Claim ${claim._id} cannot be underwritten while status is "${claim.status}"`
    );
    this.name = 'ClaimNotUnderwritableError';
    this.claim = claim;
  }
}

export async function underwriteClaimById(
  id: string,
  options: AiAnalysisOptions = {}
): Promise<{
  claim: ClaimRecord;
  result: UnderwritingResult;
  aiAnalysis: AiAnalysis;
  aiReused: boolean;
  ruleResult: ContractRuleResult;
  policyHistory: PolicyHistoryContext;
} | null> {
  const claim = await getClaimById(id);
  if (!claim) return null;

  if (!UNDERWRITABLE_STATUSES.has(claim.status)) {
    throw new ClaimNotUnderwritableError(claim);
  }

  const policyHistory = await getPolicyHistoryForClaim(claim);
  const ruleResult = evaluateContractRules(claim, { policyHistory });
  const aiReused = shouldReuseAiAnalysis(claim.aiAnalysis, options.force);
  const aiAnalysis = await resolveAiAnalysis(claim, options, policyHistory);
  const combined = combineDecisions(ruleResult.decision, aiAnalysis);

  const underwriting = {
    decision: combined.decision === 'under_review' ? 'pending' : combined.decision,
    reason: combined.reason,
    reviewedAt: new Date().toISOString(),
    source: 'ai' as const,
  };

  const fromStatus = claim.status;
  const sql = getSql();
  const rows = (await sql`
    UPDATE claims
    SET status = ${combined.decision},
        underwriting = ${JSON.stringify(underwriting)}::jsonb,
        ai_analysis = ${JSON.stringify(aiAnalysis)}::jsonb,
        updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING *
  `) as ClaimRow[];

  const updated = mapRow(rows[0]);
  await safeAppendClaimEvent({
    claimId: id,
    eventType: 'underwritten',
    summary: `AI underwrite → ${combined.decision.replace('_', ' ')} (rules: ${ruleResult.decision}, AI: ${aiAnalysis.recommendation}${aiReused ? ', AI reused' : ''})`,
    actorEmail: options.actorEmail,
    actorRole: options.actorRole,
    fromStatus,
    toStatus: combined.decision,
    detail: {
      source: 'ai',
      ruleDecision: ruleResult.decision,
      aiRecommendation: aiAnalysis.recommendation,
      riskScore: aiAnalysis.riskScore,
      reason: combined.reason,
      aiReused,
    },
  });

  return {
    claim: updated,
    result: {
      decision:
        combined.decision === 'under_review'
          ? 'pending'
          : combined.decision,
      reason: combined.reason,
    },
    aiAnalysis,
    aiReused,
    ruleResult,
    policyHistory,
  };
}