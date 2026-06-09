import type {
  ContractDefinition,
  ContractType,
  ContractTypeOrUnknown,
  ContractVariant,
} from './types';

export const CONTRACT_REGISTRY: Record<ContractType, ContractDefinition> = {
  classic: {
    type: 'classic',
    displayName: 'Freedom Classic',
    productName: 'Classic Plan',
    coverageModel: 'stated',
    waitingPeriodDays: 90,
    waitingPeriodMiles: 200,
    deductibleType: 'per_claim',
    maxPerClaim: 10_000,
    maxAggregate: 40_000,
    summary:
      'Stated-component contract. Only parts listed in Section 2(a) are covered. 90-day / 200-mile waiting period.',
    referenceFile: 'contracts/classic.html',
  },
  vital: {
    type: 'vital',
    displayName: 'Freedom Vital',
    productName: 'Vital Plan',
    coverageModel: 'stated',
    waitingPeriodDays: 30,
    waitingPeriodMiles: 1_000,
    deductibleType: 'per_component',
    maxPerClaim: 10_000,
    maxAggregate: 10_000,
    summary:
      'Stated-component contract. Components must be listed in Section 2 What is Covered. 30-day / 1,000-mile waiting period.',
    referenceFile: 'contracts/vital.html',
  },
  drive: {
    type: 'drive',
    displayName: 'Freedom Drive',
    productName: 'Drive Plan',
    coverageModel: 'stated',
    waitingPeriodDays: 30,
    waitingPeriodMiles: 1_000,
    deductibleType: 'per_component',
    maxPerClaim: 10_000,
    maxAggregate: 10_000,
    summary:
      'Stated-component contract. Only listed components are covered. 30-day / 1,000-mile waiting period.',
    referenceFile: 'contracts/drive.html',
  },
  complete: {
    type: 'complete',
    displayName: 'Freedom Complete',
    productName: 'Complete Plan',
    coverageModel: 'exclusionary',
    waitingPeriodDays: 30,
    waitingPeriodMiles: 1_000,
    deductibleType: 'per_component',
    maxPerClaim: 10_000,
    maxAggregate: 40_000,
    summary:
      'Exclusionary contract. Parts not listed in Section 2 exclusions are covered. 30-day / 1,000-mile waiting period.',
    referenceFile: 'contracts/complete.html',
  },
};

export const POLICY_PREFIXES = [
  {
    prefix: 'FWCPM',
    type: 'complete' as ContractType,
    variant: 'manufacturer_extension' as ContractVariant,
    label: "Freedom Complete — Manufacturer's Extension",
  },
  {
    prefix: 'FWCP',
    type: 'complete' as ContractType,
    variant: 'standard' as ContractVariant,
    label: 'Freedom Complete',
  },
  {
    prefix: 'FWDR',
    type: 'drive' as ContractType,
    variant: 'standard' as ContractVariant,
    label: 'Freedom Drive',
  },
  {
    prefix: 'FWVL',
    type: 'vital' as ContractType,
    variant: 'standard' as ContractVariant,
    label: 'Freedom Vital',
  },
  {
    prefix: 'FWCL',
    type: 'classic' as ContractType,
    variant: 'standard' as ContractVariant,
    label: 'Freedom Classic',
  },
];

export function getContractDefinition(
  type: ContractTypeOrUnknown
): ContractDefinition | null {
  if (type === 'unknown') return null;
  return CONTRACT_REGISTRY[type];
}

export function getContractDisplayName(
  type: ContractTypeOrUnknown,
  variant: ContractVariant = 'standard'
): string {
  if (type === 'complete' && variant === 'manufacturer_extension') {
    return "Freedom Complete — Manufacturer's Extension";
  }
  const def = getContractDefinition(type);
  return def?.displayName ?? 'Unknown contract';
}

export function buildContractContext(
  type: ContractTypeOrUnknown,
  variant: ContractVariant = 'standard'
): string {
  const def = getContractDefinition(type);
  if (!def) return 'Contract type: unknown';

  const displayName = getContractDisplayName(type, variant);

  return [
    `Contract: ${displayName}`,
    `Coverage model: ${def.coverageModel}`,
    `Waiting period: ${def.waitingPeriodDays} days AND ${def.waitingPeriodMiles} miles`,
    `Deductible: ${def.deductibleType.replace('_', ' ')}`,
    `Limits: $${def.maxPerClaim.toLocaleString()} per claim, $${def.maxAggregate.toLocaleString()} aggregate`,
    def.summary,
    def.coverageModel === 'stated'
      ? 'Coverage rule: component must be LISTED in Section 2 What is Covered.'
      : 'Coverage rule: component must NOT be in Section 2 exclusions.',
  ].join('\n');
}