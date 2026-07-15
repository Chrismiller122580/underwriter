import type { ClaimRecord } from '@/lib/claims-store';
import { evaluateContractRules } from '@/lib/contract-rules';
import { getContractDefinition } from '@/lib/contracts/registry';
import type { ContractTypeOrUnknown } from '@/lib/contracts/types';
import {
  FILE_FIELD_LABELS,
  FILE_FIELDS,
} from '@/lib/parse-claim-form';

export type PortalClaim = ClaimRecord;

export type ClaimFilter =
  | 'all'
  | 'action_needed'
  | 'needs_info'
  | 'guideline_flags'
  | 'high_risk'
  | 'under_review'
  | 'no_ai';

export type ContractFilter = 'all' | ContractTypeOrUnknown;

export function getMissingDocuments(claim: PortalClaim) {
  const attached = claim.claimDetails.attachedDocuments ?? {};
  return FILE_FIELDS.filter((field) => !attached[field]).map((field) => ({
    field,
    label: FILE_FIELD_LABELS[field],
  }));
}

export function getAttachedDocuments(claim: PortalClaim) {
  const attached = claim.claimDetails.attachedDocuments ?? {};
  return FILE_FIELDS.filter((field) => attached[field]).map((field) => ({
    field,
    label: FILE_FIELD_LABELS[field],
    url: attached[field],
  }));
}

export function claimNeedsAction(claim: PortalClaim): boolean {
  return (
    claim.status === 'pending' ||
    claim.status === 'under_review' ||
    claim.status === 'needs_info' ||
    Boolean(claim.infoRequest) ||
    !claim.aiAnalysis ||
    (claim.aiAnalysis.informationRequests?.length ?? 0) > 0 ||
    (claim.aiAnalysis.guidelineConflicts?.length ?? 0) > 0
  );
}

export function claimPriorityScore(claim: PortalClaim): number {
  let score = 0;
  if (claim.status === 'pending') score += 20;
  if (claim.status === 'under_review') score += 18;
  if (claim.status === 'needs_info' || claim.infoRequest) score += 28;
  if (!claim.aiAnalysis) score += 15;
  if ((claim.aiAnalysis?.informationRequests?.length ?? 0) > 0) score += 25;
  if ((claim.aiAnalysis?.guidelineConflicts?.length ?? 0) > 0) score += 20;
  if ((claim.aiAnalysis?.riskScore ?? 0) >= 8) score += 22;
  else if ((claim.aiAnalysis?.riskScore ?? 0) >= 5) score += 10;
  if (claim.aiAnalysis?.recommendation === 'deny') score += 15;
  if (claim.aiAnalysis?.recommendation === 'review') score += 8;
  if (getMissingDocuments(claim).length === FILE_FIELDS.length) score += 5;
  return score;
}

export function filterClaims(
  claims: PortalClaim[],
  statusFilter: ClaimFilter,
  contractFilter: ContractFilter
): PortalClaim[] {
  return claims.filter((claim) => {
    const contractType = claim.policyInformation.contractType ?? 'unknown';
    if (contractFilter !== 'all' && contractType !== contractFilter) {
      return false;
    }

    switch (statusFilter) {
      case 'action_needed':
        return claimNeedsAction(claim);
      case 'needs_info':
        return (
          claim.status === 'needs_info' ||
          Boolean(claim.infoRequest) ||
          (claim.aiAnalysis?.informationRequests?.length ?? 0) > 0
        );
      case 'guideline_flags':
        return (claim.aiAnalysis?.guidelineConflicts?.length ?? 0) > 0;
      case 'high_risk':
        return (claim.aiAnalysis?.riskScore ?? 0) >= 7;
      case 'under_review':
        return (
          claim.status === 'under_review' || claim.status === 'needs_info'
        );
      case 'no_ai':
        return !claim.aiAnalysis;
      default:
        return true;
    }
  });
}

export function sortClaims(
  claims: PortalClaim[],
  sortBy: 'priority' | 'newest' | 'risk' | 'amount'
): PortalClaim[] {
  const copy = [...claims];
  switch (sortBy) {
    case 'newest':
      return copy.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case 'risk':
      return copy.sort(
        (a, b) =>
          (b.aiAnalysis?.riskScore ?? -1) - (a.aiAnalysis?.riskScore ?? -1)
      );
    case 'amount':
      return copy.sort((a, b) => b.claimDetails.amount - a.claimDetails.amount);
    default:
      return copy.sort((a, b) => claimPriorityScore(b) - claimPriorityScore(a));
  }
}

export function getContractBrief(type: ContractTypeOrUnknown | undefined) {
  if (!type || type === 'unknown') {
    return {
      title: 'Unknown contract',
      lines: ['Contract type could not be resolved from the policy number.'],
    };
  }

  const def = getContractDefinition(type);
  if (!def) {
    return { title: 'Unknown contract', lines: [] };
  }

  return {
    title: def.displayName,
    lines: [
      `${def.coverageModel === 'stated' ? 'Stated' : 'Exclusionary'} coverage`,
      `Waiting: ${def.waitingPeriodDays} days AND ${def.waitingPeriodMiles} miles`,
      `Limits: $${def.maxPerClaim.toLocaleString()} / claim, $${def.maxAggregate.toLocaleString()} aggregate`,
      def.coverageModel === 'stated'
        ? 'Verify repair is in the covered component list.'
        : 'Verify repair is NOT in the exclusion list.',
    ],
  };
}

export function getContractRulePreview(claim: PortalClaim) {
  return evaluateContractRules(claim);
}

export type UnderwritingReadiness = {
  canUnderwrite: boolean;
  blockers: string[];
  warnings: string[];
  nextAction: string;
  tone: 'ready' | 'blocked' | 'review' | 'done';
};

export function getUnderwritingReadiness(claim: PortalClaim): UnderwritingReadiness {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (
    claim.status !== 'pending' &&
    claim.status !== 'under_review' &&
    claim.status !== 'needs_info'
  ) {
    return {
      canUnderwrite: false,
      blockers: [`Claim is ${claim.status.replace('_', ' ')}`],
      warnings: [],
      nextAction: 'No further underwriting — claim already decided.',
      tone: 'done',
    };
  }

  if (!claim.aiAnalysis) {
    blockers.push('Run AI Scan before underwriting');
  }

  const rulePreview = getContractRulePreview(claim);
  if (rulePreview.decision === 'denied') {
    warnings.push(`Contract rules: ${rulePreview.reason}`);
  } else if (rulePreview.decision === 'pending') {
    warnings.push(`Contract rules pending: ${rulePreview.reason}`);
  }

  if (claim.infoRequest?.items?.length) {
    warnings.push(
      `Open info request (${claim.infoRequest.items.length} item(s))`
    );
  }

  if ((claim.aiAnalysis?.informationRequests?.length ?? 0) > 0) {
    warnings.push(
      `${claim.aiAnalysis!.informationRequests!.length} AI information request(s) suggested`
    );
  }

  if ((claim.aiAnalysis?.guidelineConflicts?.length ?? 0) > 0) {
    warnings.push('Guideline conflicts flagged by AI');
  }

  if ((claim.aiAnalysis?.riskScore ?? 0) >= 8) {
    warnings.push('High risk score — manual review recommended');
  }

  const missingDocs = getMissingDocuments(claim);
  if (missingDocs.length === FILE_FIELDS.length) {
    warnings.push('No supporting documents attached');
  }

  let nextAction = 'Run AI Underwrite for a final decision';
  let tone: UnderwritingReadiness['tone'] = 'ready';

  if (!claim.aiAnalysis) {
    nextAction = 'Run AI Scan to assess risk, coverage fit, and documentation gaps';
    tone = 'blocked';
  } else if (claim.infoRequest?.items?.length) {
    nextAction =
      'Info requested from claimant — clear the request when received, then underwrite';
    tone = 'review';
  } else if ((claim.aiAnalysis.guidelineConflicts?.length ?? 0) > 0) {
    nextAction = 'Review guideline conflicts, then underwrite or request more info';
    tone = 'review';
  } else if ((claim.aiAnalysis.informationRequests?.length ?? 0) > 0) {
    nextAction =
      'Request missing information from claimant (use Request Info) before final decision';
    tone = 'review';
  } else if (claim.aiAnalysis.recommendation === 'review' || (claim.aiAnalysis.riskScore ?? 0) >= 7) {
    nextAction = 'Manual review recommended — verify AI reasoning before underwriting';
    tone = 'review';
  } else if (rulePreview.decision === 'denied') {
    nextAction = 'Contract rules suggest denial — confirm with AI Underwrite';
    tone = 'review';
  } else if (claim.aiAnalysis.recommendation === 'approve' && rulePreview.decision === 'approved') {
    nextAction = 'AI and contract rules align — ready for AI Underwrite';
    tone = 'ready';
  }

  return {
    canUnderwrite: blockers.length === 0,
    blockers,
    warnings,
    nextAction,
    tone,
  };
}

export function portalStats(claims: PortalClaim[]) {
  return {
    total: claims.length,
    pending: claims.filter((c) => c.status === 'pending').length,
    underReview: claims.filter((c) => c.status === 'under_review').length,
    approved: claims.filter((c) => c.status === 'approved').length,
    denied: claims.filter((c) => c.status === 'denied').length,
    needsInfo: claims.filter(
      (c) => (c.aiAnalysis?.informationRequests?.length ?? 0) > 0
    ).length,
    guidelineFlags: claims.filter(
      (c) => (c.aiAnalysis?.guidelineConflicts?.length ?? 0) > 0
    ).length,
    noAi: claims.filter((c) => !c.aiAnalysis).length,
    highRisk: claims.filter((c) => (c.aiAnalysis?.riskScore ?? 0) >= 7).length,
    actionQueue: claims.filter((c) => claimNeedsAction(c)).length,
  };
}