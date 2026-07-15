import { getContractDefinition } from '@/lib/contracts/registry';
import type { ContractTypeOrUnknown } from '@/lib/contracts/types';

export type RelatedClaimSummary = {
  id: string;
  status: string;
  amount: number;
  policyNumber: string;
  vin: string;
  repairDescription: string;
  dateOfLoss: string;
  createdAt: string;
  decision?: string;
};

/** Minimal claim shape for summary mapping (avoids circular imports). */
export type ClaimLikeForHistory = {
  _id: string;
  status: string;
  claimDetails: { amount: number };
  policyInformation: { policyNumber: string };
  vehicleInfo: { vin: string };
  repairInformation: { detailedRepairDescription: string };
  incidentDetails: { dateOfLoss: string };
  createdAt: string;
  underwriting?: { decision?: string };
};

export type PolicyHistoryContext = {
  policyNumber: string;
  relatedClaims: RelatedClaimSummary[];
  /** Sum of approved claim amounts on this policy (excluding current). */
  approvedAggregate: number;
  /**
   * Sum of open claim amounts (pending / under_review) excluding current —
   * used for conservative remaining capacity.
   */
  openAggregate: number;
  maxAggregate: number | null;
  /** maxAggregate - approvedAggregate (null if unknown contract). */
  remainingAfterApproved: number | null;
  /** remaining after approved + open peers. */
  remainingConservative: number | null;
  /** Current claim estimate that would push over aggregate if approved. */
  wouldExceedAggregate: boolean;
  /** Repair phrases seen on prior approved claims (component reuse signal). */
  priorApprovedRepairs: string[];
};

export function toRelatedClaimSummary(
  claim: ClaimLikeForHistory
): RelatedClaimSummary {
  return {
    id: claim._id,
    status: claim.status,
    amount: claim.claimDetails.amount,
    policyNumber: claim.policyInformation.policyNumber,
    vin: claim.vehicleInfo.vin,
    repairDescription: claim.repairInformation.detailedRepairDescription,
    dateOfLoss: claim.incidentDetails.dateOfLoss,
    createdAt: claim.createdAt,
    decision: claim.underwriting?.decision,
  };
}

/**
 * Build aggregate LOL context from peer claims on the same policy.
 * `peers` must exclude the claim currently under review.
 */
export function buildPolicyHistoryContext(
  policyNumber: string,
  contractType: ContractTypeOrUnknown | undefined,
  currentEstimate: number,
  peers: RelatedClaimSummary[]
): PolicyHistoryContext {
  const def = contractType ? getContractDefinition(contractType) : null;
  const maxAggregate = def?.maxAggregate ?? null;

  const approvedAggregate = peers
    .filter((c) => c.status === 'approved')
    .reduce((sum, c) => sum + (Number.isFinite(c.amount) ? c.amount : 0), 0);

  const openAggregate = peers
    .filter((c) => c.status === 'pending' || c.status === 'under_review')
    .reduce((sum, c) => sum + (Number.isFinite(c.amount) ? c.amount : 0), 0);

  const remainingAfterApproved =
    maxAggregate == null ? null : maxAggregate - approvedAggregate;

  const remainingConservative =
    maxAggregate == null
      ? null
      : maxAggregate - approvedAggregate - openAggregate;

  const wouldExceedAggregate =
    maxAggregate != null && approvedAggregate + currentEstimate > maxAggregate;

  const priorApprovedRepairs = peers
    .filter((c) => c.status === 'approved')
    .map((c) => c.repairDescription)
    .filter(Boolean)
    .slice(0, 10);

  return {
    policyNumber,
    relatedClaims: peers,
    approvedAggregate,
    openAggregate,
    maxAggregate,
    remainingAfterApproved,
    remainingConservative,
    wouldExceedAggregate,
    priorApprovedRepairs,
  };
}

/** Compact JSON for AI prompts and logging. */
export function formatPolicyHistoryForPrompt(
  history: PolicyHistoryContext | null | undefined
): Record<string, unknown> | null {
  if (!history) return null;

  return {
    policyNumber: history.policyNumber,
    maxAggregate: history.maxAggregate,
    approvedAggregate: history.approvedAggregate,
    openAggregate: history.openAggregate,
    remainingAfterApproved: history.remainingAfterApproved,
    remainingConservative: history.remainingConservative,
    wouldExceedAggregate: history.wouldExceedAggregate,
    relatedClaimCount: history.relatedClaims.length,
    priorApprovedRepairs: history.priorApprovedRepairs,
    relatedClaims: history.relatedClaims.map((c) => ({
      id: c.id,
      status: c.status,
      amount: c.amount,
      vin: c.vin,
      repair: c.repairDescription,
      dateOfLoss: c.dateOfLoss,
    })),
  };
}
