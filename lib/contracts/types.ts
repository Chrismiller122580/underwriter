export const CONTRACT_TYPES = [
  'classic',
  'vital',
  'drive',
  'complete',
] as const;

export type ContractType = (typeof CONTRACT_TYPES)[number];

export type ContractTypeOrUnknown = ContractType | 'unknown';

export type ContractVariant = 'standard' | 'manufacturer_extension';

export type CoverageModel = 'stated' | 'exclusionary';

export type DetectionSource = 'policy_number' | 'filename' | 'ai' | 'manual';

export type ContractDefinition = {
  type: ContractType;
  displayName: string;
  productName: string;
  coverageModel: CoverageModel;
  waitingPeriodDays: number;
  waitingPeriodMiles: number;
  deductibleType: 'per_claim' | 'per_component';
  maxPerClaim: number;
  maxAggregate: number;
  summary: string;
  referenceFile: string;
};

export type ParsedPolicyNumber = {
  valid: boolean;
  contractType: ContractTypeOrUnknown;
  variant: ContractVariant;
  displayName: string | null;
  prefix: string | null;
  accountId: string | null;
  confidence: number;
  source: DetectionSource;
};

export type PolicyLookupResult = ParsedPolicyNumber & {
  vehicle?: {
    vin?: string;
    make?: string;
    model?: string;
    year?: number;
    odometerReading?: number;
  };
  coverageDetails?: string;
};