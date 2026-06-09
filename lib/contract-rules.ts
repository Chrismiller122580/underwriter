import { getContractDefinition } from '@/lib/contracts/registry';
import type { ClaimRecord } from '@/lib/claims-store';
import type { ContractTypeOrUnknown } from '@/lib/contracts/types';
import type { UnderwritingResult } from '@/lib/underwrite';

export type ContractRuleResult = UnderwritingResult & {
  flags: string[];
  denialCategory?:
    | 'waiting_period'
    | 'non_covered'
    | 'invalid_contract'
    | 'maintenance'
    | 'limit_exceeded'
    | null;
};

function getContractType(claim: ClaimRecord): ContractTypeOrUnknown {
  return claim.policyInformation.contractType ?? 'unknown';
}

export function evaluateContractRules(claim: ClaimRecord): ContractRuleResult {
  const flags: string[] = [];
  const contractType = getContractType(claim);
  const def = getContractDefinition(contractType);

  const now = new Date();
  const effective = new Date(claim.policyInformation.policyEffectiveDate);
  const expiration = new Date(claim.policyInformation.policyExpirationDate);
  const lossDate = new Date(claim.incidentDetails.dateOfLoss);
  const estimate = claim.repairInformation.repairEstimate;
  const odometer = claim.vehicleInfo.odometerReading;

  if (contractType === 'unknown') {
    flags.push('Contract type could not be identified from policy number');
    return {
      decision: 'pending',
      reason: 'Contract type unknown — adjuster review required.',
      flags,
      denialCategory: null,
    };
  }

  if (!def) {
    return {
      decision: 'pending',
      reason: 'Contract definition not found.',
      flags,
      denialCategory: null,
    };
  }

  if (now < effective || now > expiration) {
    flags.push('Policy is not currently active');
    return {
      decision: 'denied',
      reason: 'DENIED — Contract is not active (expired or not yet effective).',
      flags,
      denialCategory: 'invalid_contract',
    };
  }

  if (lossDate < effective || lossDate > expiration) {
    flags.push('Date of loss falls outside policy period');
    return {
      decision: 'denied',
      reason: 'DENIED — Date of loss falls outside the active contract period.',
      flags,
      denialCategory: 'invalid_contract',
    };
  }

  const daysSinceEffective = Math.floor(
    (lossDate.getTime() - effective.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceEffective < def.waitingPeriodDays) {
    flags.push(`Waiting period not met: ${daysSinceEffective} days since effective (requires ${def.waitingPeriodDays})`);
    return {
      decision: 'denied',
      reason: 'DENIED — Waiting Period Not Met (days).',
      flags,
      denialCategory: 'waiting_period',
    };
  }

  if (estimate > def.maxPerClaim) {
    flags.push(`Repair estimate $${estimate} exceeds per-claim limit $${def.maxPerClaim}`);
    return {
      decision: 'denied',
      reason: `DENIED — Repair estimate exceeds $${def.maxPerClaim.toLocaleString()} per-claim limit.`,
      flags,
      denialCategory: 'limit_exceeded',
    };
  }

  if (!odometer || odometer <= 0) {
    flags.push('Current mileage is required to validate contract');
    return {
      decision: 'pending',
      reason: 'Accurate mileage required before authorization.',
      flags,
      denialCategory: null,
    };
  }

  if (odometer === 99999) {
    flags.push('Placeholder mileage 99999 — accurate mileage required');
    return {
      decision: 'pending',
      reason: 'Cannot authorize until accurate mileage is provided.',
      flags,
      denialCategory: null,
    };
  }

  const repairDesc = claim.repairInformation.detailedRepairDescription.toLowerCase();
  const majorComponents = ['engine', 'transmission', 'turbo', 'timing chain'];
  if (majorComponents.some((c) => repairDesc.includes(c)) && estimate > 5000) {
    flags.push('Major component repair — inspection may be recommended');
    return {
      decision: 'pending',
      reason: 'Major component claim — recommend inspection per underwriting guidelines.',
      flags,
      denialCategory: null,
    };
  }

  if (def.coverageModel === 'stated') {
    flags.push(`Stated-component contract (${def.displayName}) — verify repair is in covered list`);
  } else {
    flags.push(`Exclusionary contract (${def.displayName}) — verify repair is not in exclusion list`);
  }

  return {
    decision: 'approved',
    reason: `Contract rules passed for ${def.displayName}. AI underwriting required for final decision.`,
    flags,
    denialCategory: null,
  };
}