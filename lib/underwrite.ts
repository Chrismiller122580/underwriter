export type UnderwritingInput = {
  policyEffectiveDate: Date;
  policyExpirationDate: Date;
  dateOfLoss: Date;
  repairEstimate: number;
};

export type UnderwritingResult = {
  decision: 'approved' | 'denied' | 'pending';
  reason: string;
};

export function underwriteClaim(input: UnderwritingInput): UnderwritingResult {
  const now = new Date();
  const { policyEffectiveDate, policyExpirationDate, dateOfLoss, repairEstimate } =
    input;

  if (now < policyEffectiveDate || now > policyExpirationDate) {
    return {
      decision: 'denied',
      reason: 'Policy is not active.',
    };
  }

  if (dateOfLoss < policyEffectiveDate || dateOfLoss > policyExpirationDate) {
    return {
      decision: 'denied',
      reason: 'Date of loss falls outside the active policy period.',
    };
  }

  if (repairEstimate <= 0) {
    return {
      decision: 'denied',
      reason: 'Repair estimate must be greater than zero.',
    };
  }

  return {
    decision: 'approved',
    reason: 'Policy is active and claim is valid for further processing.',
  };
}

export function mapDecisionToStatus(
  decision: UnderwritingResult['decision']
): 'approved' | 'denied' | 'under_review' {
  if (decision === 'approved') return 'approved';
  if (decision === 'denied') return 'denied';
  return 'under_review';
}