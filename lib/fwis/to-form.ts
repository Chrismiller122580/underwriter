import { parsePolicyNumber } from '@/lib/contracts/policy-patterns';
import type { ContractType, ContractVariant } from '@/lib/contracts/types';
import type { ExtractableField } from '@/lib/extract-claim';
import type { FwisClaimRecord, FwisPolicyRecord } from '@/lib/fwis/types';

export type FwisFormImport = {
  fields: Partial<Record<ExtractableField, string>>;
  fieldsFound: ExtractableField[];
  contractType: ContractType | 'unknown';
  contractVariant: ContractVariant;
  fwisClaimId: string | null;
  fwisContractNumber: string;
  fwisClaimNumber: string;
  warnings: string[];
};

function dateOnly(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  // Accept ISO or YYYY-MM-DD
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return undefined;
}

function strNum(n: number | null | undefined): string | undefined {
  if (n == null || !Number.isFinite(n)) return undefined;
  return String(n);
}

/**
 * Merge FWIS policy + claim into claim form fields.
 * Claim data wins over policy for overlapping vehicle/claimant fields.
 */
export function fwisRecordsToFormImport(
  contractNumber: string,
  claimNumber: string,
  policy: FwisPolicyRecord | null,
  claim: FwisClaimRecord | null
): FwisFormImport {
  const warnings: string[] = [];
  const fields: Partial<Record<ExtractableField, string>> = {};

  const policyNumber =
    claim?.policyNumber || policy?.policyNumber || contractNumber;
  fields.policyNumber = policyNumber;

  if (policy?.coverageDetails) fields.coverageDetails = policy.coverageDetails;
  if (policy?.effectiveDate) {
    const d = dateOnly(policy.effectiveDate);
    if (d) fields.policyEffectiveDate = d;
  }
  if (policy?.expirationDate) {
    const d = dateOnly(policy.expirationDate);
    if (d) fields.policyExpirationDate = d;
  }
  if (policy?.odometerAtEffective != null) {
    fields.odometerAtEffective = strNum(policy.odometerAtEffective);
  }

  // Vehicle: prefer claim, then policy
  const vin = claim?.vin || policy?.vin;
  const make = claim?.make || policy?.make;
  const model = claim?.model || policy?.model;
  const year = claim?.year ?? policy?.year;
  if (vin) fields.vin = vin;
  if (make) fields.make = make;
  if (model) fields.model = model;
  if (year != null) fields.year = strNum(year);

  if (claim?.odometer != null) fields.odometerReading = strNum(claim.odometer);
  if (claim?.claimantName) fields.name = claim.claimantName;
  if (claim?.contact) fields.contactInformation = claim.contact;
  if (claim?.relationship) fields.relationshipToVehicle = claim.relationship;
  else fields.relationshipToVehicle = fields.relationshipToVehicle || 'Owner';

  if (claim?.dateOfLoss) {
    const d = dateOnly(claim.dateOfLoss);
    if (d) fields.dateOfLoss = d;
  }
  if (claim?.description) fields.descriptionOfIncident = claim.description;
  if (claim?.location) fields.locationOfIncident = claim.location;
  else if (!fields.locationOfIncident) {
    warnings.push('Location of incident not provided by FWIS — enter manually if known.');
  }

  if (claim?.repairEstimate != null) {
    fields.repairEstimate = strNum(claim.repairEstimate);
  }
  if (claim?.repairDescription) {
    fields.detailedRepairDescription = claim.repairDescription;
  }
  if (claim?.shop) fields.repairShopInformation = claim.shop;

  // Coverage details fallback from local prefix parse
  const parsed = parsePolicyNumber(policyNumber);
  if (!fields.coverageDetails && parsed.displayName) {
    fields.coverageDetails = parsed.displayName;
  }

  let contractType: ContractType | 'unknown' = parsed.contractType;
  let contractVariant: ContractVariant = parsed.variant;

  if (policy?.contractType) {
    const t = policy.contractType.toLowerCase();
    if (['classic', 'vital', 'drive', 'complete'].includes(t)) {
      contractType = t as ContractType;
    }
  }
  if (policy?.contractVariant === 'manufacturer_extension') {
    contractVariant = 'manufacturer_extension';
  }

  if (!claim) {
    warnings.push('Claim record was empty — only contract/policy data was loaded.');
  }
  if (!policy) {
    warnings.push(
      'Policy/contract record was empty — form filled from claim payload only.'
    );
  }

  const fieldsFound = (Object.keys(fields) as ExtractableField[]).filter(
    (k) => Boolean(fields[k]?.trim())
  );

  const required: ExtractableField[] = [
    'policyNumber',
    'coverageDetails',
    'policyEffectiveDate',
    'policyExpirationDate',
    'vin',
    'make',
    'model',
    'year',
    'odometerReading',
    'name',
    'contactInformation',
    'dateOfLoss',
    'descriptionOfIncident',
    'locationOfIncident',
    'repairEstimate',
    'detailedRepairDescription',
    'repairShopInformation',
  ];
  const missing = required.filter((k) => !fields[k]?.trim());
  if (missing.length > 0) {
    warnings.push(
      `FWIS did not supply: ${missing.join(', ')}. Complete these before submit.`
    );
  }

  return {
    fields,
    fieldsFound,
    contractType,
    contractVariant,
    fwisClaimId: claim?.fwisClaimId ?? null,
    fwisContractNumber: policyNumber,
    fwisClaimNumber: claim?.claimNumber || claimNumber,
    warnings,
  };
}
