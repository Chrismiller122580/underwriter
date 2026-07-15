import { evaluateComponentCoverage } from '@/lib/contracts/components';
import { getContractDefinition } from '@/lib/contracts/registry';
import type { ClaimRecord } from '@/lib/claims-store';
import type { ContractTypeOrUnknown } from '@/lib/contracts/types';
import type { PolicyHistoryContext } from '@/lib/policy-history';
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
  componentCoverage?: ReturnType<typeof evaluateComponentCoverage>;
  policyHistory?: PolicyHistoryContext | null;
};

export type RuleEvaluationContext = {
  /** Peer claims on the same policy (excluding current claim). */
  policyHistory?: PolicyHistoryContext | null;
};

function getContractType(claim: ClaimRecord): ContractTypeOrUnknown {
  return claim.policyInformation.contractType ?? 'unknown';
}

export function evaluateContractRules(
  claim: ClaimRecord,
  context: RuleEvaluationContext = {}
): ContractRuleResult {
  const flags: string[] = [];
  const contractType = getContractType(claim);
  const def = getContractDefinition(contractType);
  const policyHistory = context.policyHistory ?? null;

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
      policyHistory,
    };
  }

  if (!def) {
    return {
      decision: 'pending',
      reason: 'Contract definition not found.',
      flags,
      denialCategory: null,
      policyHistory,
    };
  }

  if (now < effective || now > expiration) {
    flags.push('Policy is not currently active');
    return {
      decision: 'denied',
      reason: 'DENIED — Contract is not active (expired or not yet effective).',
      flags,
      denialCategory: 'invalid_contract',
      policyHistory,
    };
  }

  if (lossDate < effective || lossDate > expiration) {
    flags.push('Date of loss falls outside policy period');
    return {
      decision: 'denied',
      reason: 'DENIED — Date of loss falls outside the active contract period.',
      flags,
      denialCategory: 'invalid_contract',
      policyHistory,
    };
  }

  const daysSinceEffective = Math.floor(
    (lossDate.getTime() - effective.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceEffective < def.waitingPeriodDays) {
    flags.push(
      `Waiting period not met: ${daysSinceEffective} days since effective (requires ${def.waitingPeriodDays})`
    );
    return {
      decision: 'denied',
      reason: 'DENIED — Waiting Period Not Met (days).',
      flags,
      denialCategory: 'waiting_period',
      policyHistory,
    };
  }

  if (!odometer || odometer <= 0) {
    flags.push('Current mileage is required to validate contract');
    return {
      decision: 'pending',
      reason: 'Accurate mileage required before authorization.',
      flags,
      denialCategory: null,
      policyHistory,
    };
  }

  if (odometer === 99999) {
    flags.push('Placeholder mileage 99999 — accurate mileage required');
    return {
      decision: 'pending',
      reason: 'Cannot authorize until accurate mileage is provided.',
      flags,
      denialCategory: null,
      policyHistory,
    };
  }

  const odometerAtEffective = claim.vehicleInfo.odometerAtEffective;
  if (odometerAtEffective == null || odometerAtEffective < 0) {
    flags.push(
      `Odometer at policy effective date required to verify ${def.waitingPeriodMiles}-mile waiting period`
    );
    return {
      decision: 'pending',
      reason: 'Mileage at policy start required to verify waiting-period miles.',
      flags,
      denialCategory: null,
      policyHistory,
    };
  }

  const milesSinceEffective = odometer - odometerAtEffective;
  if (milesSinceEffective < def.waitingPeriodMiles) {
    flags.push(
      `Waiting period not met: ${milesSinceEffective} miles since effective (requires ${def.waitingPeriodMiles})`
    );
    return {
      decision: 'denied',
      reason: 'DENIED — Waiting Period Not Met (miles).',
      flags,
      denialCategory: 'waiting_period',
      policyHistory,
    };
  }

  if (estimate > def.maxPerClaim) {
    flags.push(
      `Repair estimate $${estimate} exceeds per-claim limit $${def.maxPerClaim}`
    );
    return {
      decision: 'denied',
      reason: `DENIED — Repair estimate exceeds $${def.maxPerClaim.toLocaleString()} per-claim limit.`,
      flags,
      denialCategory: 'limit_exceeded',
      policyHistory,
    };
  }

  // Aggregate limit of liability (prior approved claims on same policy)
  if (policyHistory?.maxAggregate != null) {
    flags.push(
      `Aggregate LOL: $${policyHistory.approvedAggregate.toLocaleString()} approved of $${policyHistory.maxAggregate.toLocaleString()} max` +
        (policyHistory.openAggregate > 0
          ? ` ($${policyHistory.openAggregate.toLocaleString()} open peers)`
          : '')
    );

    if (policyHistory.wouldExceedAggregate) {
      flags.push(
        `This claim ($${estimate.toLocaleString()}) would exceed aggregate: approved $${policyHistory.approvedAggregate.toLocaleString()} + estimate > $${policyHistory.maxAggregate.toLocaleString()}`
      );
      return {
        decision: 'denied',
        reason: `DENIED — Aggregate limit of liability exceeded ($${policyHistory.approvedAggregate.toLocaleString()} prior approved + $${estimate.toLocaleString()} claim > $${policyHistory.maxAggregate.toLocaleString()} max).`,
        flags,
        denialCategory: 'limit_exceeded',
        policyHistory,
      };
    }

    if (
      policyHistory.remainingConservative != null &&
      policyHistory.remainingConservative < estimate &&
      policyHistory.openAggregate > 0
    ) {
      flags.push(
        'Open peer claims reduce remaining aggregate capacity — adjuster review recommended'
      );
      return {
        decision: 'pending',
        reason:
          'Aggregate capacity constrained by other open claims on this policy — adjuster review required.',
        flags,
        denialCategory: null,
        policyHistory,
      };
    }
  }

  // Component coverage (stated lists / exclusionary lists)
  const componentCoverage = evaluateComponentCoverage(
    contractType,
    claim.repairInformation.detailedRepairDescription,
    claim.incidentDetails.descriptionOfIncident
  );
  flags.push(...componentCoverage.flags);

  if (componentCoverage.hardDeny) {
    return {
      decision: 'denied',
      reason:
        componentCoverage.status === 'excluded'
          ? `DENIED — Component appears on exclusion list (${componentCoverage.matchedLabel ?? 'excluded item'}).`
          : `DENIED — Component not covered under ${def.displayName} (${componentCoverage.matchedLabel ?? 'non-covered item'}).`,
      flags,
      denialCategory: 'non_covered',
      componentCoverage,
      policyHistory,
    };
  }

  if (componentCoverage.status === 'unclear' && def.coverageModel === 'stated') {
    flags.push('Component coverage unclear — hold for AI/adjuster confirmation');
    return {
      decision: 'pending',
      reason:
        'Component not matched to stated covered list — adjuster verification required.',
      flags,
      denialCategory: null,
      componentCoverage,
      policyHistory,
    };
  }

  // Prior approved repair similarity (same component re-claim signal)
  if (policyHistory && policyHistory.priorApprovedRepairs.length > 0) {
    const current = claim.repairInformation.detailedRepairDescription.toLowerCase();
    const reuseHit = policyHistory.priorApprovedRepairs.find((prior) => {
      const p = prior.toLowerCase();
      if (p.length < 8 || current.length < 8) return false;
      const priorWords = p.split(/\W+/).filter((w) => w.length > 4);
      const matches = priorWords.filter((w) => current.includes(w));
      return matches.length >= 2;
    });
    if (reuseHit) {
      flags.push(
        `Possible prior claim on similar repair: "${reuseHit.slice(0, 80)}"`
      );
      return {
        decision: 'pending',
        reason:
          'Possible duplicate/prior component claim on this policy — adjuster review required.',
        flags,
        denialCategory: null,
        componentCoverage,
        policyHistory,
      };
    }
  }

  const repairDesc =
    claim.repairInformation.detailedRepairDescription.toLowerCase();
  const majorComponents = ['engine', 'transmission', 'turbo', 'timing chain'];
  if (majorComponents.some((c) => repairDesc.includes(c)) && estimate > 5000) {
    flags.push('Major component repair — inspection may be recommended');
    return {
      decision: 'pending',
      reason:
        'Major component claim — recommend inspection per underwriting guidelines.',
      flags,
      denialCategory: null,
      componentCoverage,
      policyHistory,
    };
  }

  if (def.coverageModel === 'stated') {
    flags.push(
      `Stated-component contract (${def.displayName}) — coverage keywords matched or deferred to AI`
    );
  } else {
    flags.push(
      `Exclusionary contract (${def.displayName}) — no exclusion keywords matched`
    );
  }

  return {
    decision: 'approved',
    reason: `Contract rules passed for ${def.displayName}. AI underwriting required for final decision.`,
    flags,
    denialCategory: null,
    componentCoverage,
    policyHistory,
  };
}
