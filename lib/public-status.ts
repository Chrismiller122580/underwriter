import type { ClaimRecord } from '@/lib/claims-store';
import type { InfoRequestRecord } from '@/lib/info-request';

export type PublicClaimStatus = {
  trackingCode: string;
  status: string;
  statusLabel: string;
  submittedAt: string;
  policyLast4: string | null;
  contractType: string | null;
  vehicleSummary: string;
  amount: number;
  decisionSummary: string | null;
  infoRequests: string[] | null;
  lastUpdatedAt: string;
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Received — pending review',
  under_review: 'Under review by an adjuster',
  needs_info: 'Additional information requested',
  approved: 'Approved',
  denied: 'Denied',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

export function toPublicClaimStatus(claim: ClaimRecord): PublicClaimStatus {
  const policy = claim.policyInformation.policyNumber ?? '';
  const last4 = policy.length >= 4 ? policy.slice(-4) : policy || null;

  let decisionSummary: string | null = null;
  if (claim.status === 'approved' || claim.status === 'denied') {
    decisionSummary =
      claim.underwriting?.reason?.slice(0, 400) ??
      `Claim has been ${claim.status}.`;
  } else if (claim.status === 'under_review') {
    decisionSummary =
      'Your claim is being reviewed. No final decision has been issued yet.';
  } else if (claim.status === 'needs_info') {
    decisionSummary =
      'Please provide the requested information so review can continue.';
  } else {
    decisionSummary = 'Your claim has been received and is in the queue.';
  }

  const info: InfoRequestRecord | undefined = claim.infoRequest;
  const infoRequests =
    claim.status === 'needs_info' && info?.items?.length
      ? info.items
      : null;

  return {
    trackingCode: claim.publicToken ?? '',
    status: claim.status,
    statusLabel: statusLabel(claim.status),
    submittedAt: claim.createdAt,
    policyLast4: last4,
    contractType: claim.policyInformation.contractType ?? null,
    vehicleSummary: `${claim.vehicleInfo.year} ${claim.vehicleInfo.make} ${claim.vehicleInfo.model}`,
    amount: claim.claimDetails.amount,
    decisionSummary,
    infoRequests,
    lastUpdatedAt: claim.updatedAt,
  };
}

/** Normalize last name comparison (claimant name may be full name). */
export function matchesLastName(claimantName: string, lastName: string): boolean {
  const full = claimantName.trim().toLowerCase().replace(/\s+/g, ' ');
  const last = lastName.trim().toLowerCase();
  if (!full || !last) return false;
  if (full === last) return true;
  const parts = full.split(' ');
  return parts[parts.length - 1] === last || full.endsWith(` ${last}`);
}
