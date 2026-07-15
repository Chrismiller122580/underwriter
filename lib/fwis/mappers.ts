import type { FwisClaimRecord, FwisPolicyRecord } from '@/lib/fwis/types';

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const obj = value as Record<string, unknown>;
  // Some APIs wrap as { data: {...} } with no other useful top-level fields
  if (
    obj.data &&
    typeof obj.data === 'object' &&
    !Array.isArray(obj.data) &&
    !obj.policyNumber &&
    !obj.policy_number &&
    !obj.ContractNumber
  ) {
    return asRecord(obj.data);
  }
  return obj;
}

function str(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (typeof c === 'number' && Number.isFinite(c)) return String(c);
  }
  return null;
}

function num(...candidates: unknown[]): number | null {
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) return c;
    if (typeof c === 'string' && c.trim() && !Number.isNaN(Number(c))) {
      return Number(c);
    }
  }
  return null;
}

/**
 * Best-effort mapping from unknown FWIS JSON into our policy shape.
 * Extend field aliases when Freedom shares the real schema.
 */
export function mapFwisPolicyPayload(
  payload: unknown,
  fallbackPolicyNumber: string
): FwisPolicyRecord {
  const r = asRecord(payload);
  const vehicle = asRecord(r.vehicle ?? r.vehicleInfo ?? r.Vehicle);

  return {
    policyNumber:
      str(r.policyNumber, r.policy_number, r.contractNumber, r.ContractNumber) ??
      fallbackPolicyNumber,
    contractType: str(r.contractType, r.contract_type, r.planType, r.PlanType),
    contractVariant: str(
      r.contractVariant,
      r.contract_variant,
      r.variant,
      r.extensionType
    ),
    status: str(r.status, r.contractStatus, r.Status),
    effectiveDate: str(
      r.effectiveDate,
      r.effective_date,
      r.policyEffectiveDate,
      r.EffectiveDate
    ),
    expirationDate: str(
      r.expirationDate,
      r.expiration_date,
      r.policyExpirationDate,
      r.ExpirationDate
    ),
    coverageDetails: str(
      r.coverageDetails,
      r.coverage_details,
      r.planName,
      r.PlanName,
      r.productName
    ),
    vin: str(r.vin, r.VIN, vehicle.vin, vehicle.VIN),
    make: str(r.make, vehicle.make, vehicle.Make),
    model: str(r.model, vehicle.model, vehicle.Model),
    year: num(r.year, vehicle.year, vehicle.Year),
    odometerAtEffective: num(
      r.odometerAtEffective,
      r.odometer_at_effective,
      r.startMiles,
      r.odometerAtSale
    ),
    raw: payload,
  };
}

export function mapFwisClaimPayload(
  payload: unknown,
  fallbackClaimId: string
): FwisClaimRecord {
  const r = asRecord(payload);
  const vehicle = asRecord(r.vehicle ?? r.vehicleInfo);
  const claimant = asRecord(r.claimant ?? r.customer ?? r.Claimant);
  const repair = asRecord(r.repair ?? r.repairInformation);

  return {
    fwisClaimId:
      str(r.id, r.claimId, r.claim_id, r.ClaimId) ?? fallbackClaimId,
    policyNumber: str(
      r.policyNumber,
      r.policy_number,
      r.contractNumber,
      r.ContractNumber
    ),
    status: str(r.status, r.claimStatus, r.Status),
    claimantName: str(
      r.claimantName,
      claimant.name,
      claimant.fullName,
      r.customerName
    ),
    contact: str(
      r.contact,
      r.contactInformation,
      claimant.email,
      claimant.phone,
      r.email
    ),
    vin: str(r.vin, vehicle.vin),
    make: str(r.make, vehicle.make),
    model: str(r.model, vehicle.model),
    year: num(r.year, vehicle.year),
    odometer: num(r.odometer, r.odometerReading, vehicle.odometer),
    dateOfLoss: str(r.dateOfLoss, r.lossDate, r.date_of_loss),
    description: str(
      r.description,
      r.descriptionOfIncident,
      r.incidentDescription
    ),
    repairEstimate: num(
      r.repairEstimate,
      r.estimate,
      repair.estimate,
      r.claimAmount
    ),
    repairDescription: str(
      r.repairDescription,
      r.detailedRepairDescription,
      repair.description
    ),
    shop: str(r.shop, r.repairShop, r.repairShopInformation, repair.shop),
    raw: payload,
  };
}
