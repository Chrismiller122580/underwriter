import { ensureSchema, getSql } from '@/lib/db';
import type { ParsedClaimForm } from '@/lib/parse-claim-form';
import { buildClaimDocument } from '@/lib/parse-claim-form';
import {
  mapDecisionToStatus,
  underwriteClaim,
  type UnderwritingResult,
} from '@/lib/underwrite';

export type ClaimRecord = {
  _id: string;
  policyInformation: {
    policyNumber: string;
    coverageDetails: string;
    policyEffectiveDate: string;
    policyExpirationDate: string;
  };
  vehicleInfo: {
    make: string;
    model: string;
    year: number;
    vin: string;
    odometerReading: number;
  };
  claimantInformation: {
    name: string;
    contactInformation: string;
    relationshipToVehicle: string;
  };
  incidentDetails: {
    dateOfLoss: string;
    descriptionOfIncident: string;
    locationOfIncident: string;
  };
  repairInformation: {
    repairEstimate: number;
    detailedRepairDescription: string;
    repairShopInformation: string;
  };
  claimDetails: {
    description: string;
    amount: number;
    documents: string[];
  };
  status: string;
  underwriting?: {
    decision?: string;
    reason?: string;
    reviewedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
};

type ClaimRow = {
  id: string;
  policy_information: ClaimRecord['policyInformation'];
  vehicle_info: ClaimRecord['vehicleInfo'];
  claimant_information: ClaimRecord['claimantInformation'];
  incident_details: ClaimRecord['incidentDetails'];
  repair_information: ClaimRecord['repairInformation'];
  claim_details: ClaimRecord['claimDetails'];
  status: string;
  underwriting: ClaimRecord['underwriting'] | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: ClaimRow): ClaimRecord {
  return {
    _id: row.id,
    policyInformation: row.policy_information,
    vehicleInfo: row.vehicle_info,
    claimantInformation: row.claimant_information,
    incidentDetails: row.incident_details,
    repairInformation: row.repair_information,
    claimDetails: row.claim_details,
    status: row.status,
    underwriting: row.underwriting ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function listClaims(): Promise<ClaimRecord[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM claims ORDER BY created_at DESC
  `) as ClaimRow[];
  return rows.map(mapRow);
}

export async function createClaim(
  parsed: ParsedClaimForm,
  documentPaths: Record<string, string>
): Promise<ClaimRecord> {
  await ensureSchema();
  const sql = getSql();
  const doc = buildClaimDocument(parsed, documentPaths);

  const rows = (await sql`
    INSERT INTO claims (
      policy_information, vehicle_info, claimant_information,
      incident_details, repair_information, claim_details, status
    ) VALUES (
      ${JSON.stringify(doc.policyInformation)}::jsonb,
      ${JSON.stringify(doc.vehicleInfo)}::jsonb,
      ${JSON.stringify(doc.claimantInformation)}::jsonb,
      ${JSON.stringify(doc.incidentDetails)}::jsonb,
      ${JSON.stringify(doc.repairInformation)}::jsonb,
      ${JSON.stringify(doc.claimDetails)}::jsonb,
      ${doc.status}
    )
    RETURNING *
  `) as ClaimRow[];

  return mapRow(rows[0]);
}

export async function updateClaimDocuments(
  id: string,
  documentPaths: Record<string, string>
): Promise<ClaimRecord> {
  await ensureSchema();
  const sql = getSql();
  const documents = JSON.stringify(Object.values(documentPaths));

  const rows = (await sql`
    UPDATE claims
    SET claim_details = jsonb_set(claim_details, '{documents}', ${documents}::jsonb),
        updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING *
  `) as ClaimRow[];

  return mapRow(rows[0]);
}

export async function getClaimById(id: string): Promise<ClaimRecord | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM claims WHERE id = ${id}::uuid
  `) as ClaimRow[];

  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidClaimId(id: string): boolean {
  return UUID_RE.test(id);
}

export async function underwriteClaimById(
  id: string
): Promise<{ claim: ClaimRecord; result: UnderwritingResult } | null> {
  const claim = await getClaimById(id);
  if (!claim) return null;

  const result = underwriteClaim({
    policyEffectiveDate: new Date(claim.policyInformation.policyEffectiveDate),
    policyExpirationDate: new Date(claim.policyInformation.policyExpirationDate),
    dateOfLoss: new Date(claim.incidentDetails.dateOfLoss),
    repairEstimate: claim.repairInformation.repairEstimate,
  });

  const status = mapDecisionToStatus(result.decision);
  const underwriting = JSON.stringify({
    decision: result.decision,
    reason: result.reason,
    reviewedAt: new Date().toISOString(),
  });

  const sql = getSql();
  const rows = (await sql`
    UPDATE claims
    SET status = ${status},
        underwriting = ${underwriting}::jsonb,
        updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING *
  `) as ClaimRow[];

  return {
    claim: mapRow(rows[0]),
    result,
  };
}