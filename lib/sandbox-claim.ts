import type { ClaimRecord } from '@/lib/claims-store';
import type { ContractType, ContractVariant } from '@/lib/contracts/types';
import { z } from 'zod';

export const sandboxScenarioSchema = z.object({
  policyNumber: z.string().min(1).default('FWVL000001'),
  contractType: z
    .enum(['classic', 'vital', 'drive', 'complete', 'unknown'])
    .default('vital'),
  contractVariant: z
    .enum(['standard', 'manufacturer_extension'])
    .default('standard'),
  coverageDetails: z.string().default('Freedom Vital'),
  policyEffectiveDate: z.string().default('2024-01-01'),
  policyExpirationDate: z.string().default('2028-01-01'),
  vin: z.string().default('1HGCM82633A004352'),
  make: z.string().default('Honda'),
  model: z.string().default('Accord'),
  year: z.coerce.number().default(2020),
  odometerReading: z.coerce.number().default(45000),
  odometerAtEffective: z.coerce.number().default(40000),
  name: z.string().default('Sandbox Claimant'),
  contactInformation: z.string().default('sandbox@example.com'),
  relationshipToVehicle: z.string().default('Owner'),
  dateOfLoss: z.string().default('2025-06-01'),
  descriptionOfIncident: z
    .string()
    .default('Engine overheated during normal driving.'),
  locationOfIncident: z.string().default('Atlanta, GA'),
  repairEstimate: z.coerce.number().default(4200),
  detailedRepairDescription: z
    .string()
    .default('Cylinder head gasket failure, engine overheating diagnosis.'),
  repairShopInformation: z.string().default('Sandbox Repair Center'),
  attachedDocuments: z.record(z.string()).default({}),
});

export type SandboxScenario = z.infer<typeof sandboxScenarioSchema>;

export function buildSandboxClaim(
  scenario: SandboxScenario,
  id = 'sandbox'
): ClaimRecord {
  const now = new Date().toISOString();

  return {
    _id: id,
    policyInformation: {
      policyNumber: scenario.policyNumber,
      contractType: scenario.contractType as ContractType | 'unknown',
      contractVariant: scenario.contractVariant as ContractVariant,
      contractTypeSource: 'manual',
      coverageDetails: scenario.coverageDetails,
      policyEffectiveDate: scenario.policyEffectiveDate,
      policyExpirationDate: scenario.policyExpirationDate,
    },
    vehicleInfo: {
      make: scenario.make,
      model: scenario.model,
      year: scenario.year,
      vin: scenario.vin,
      odometerReading: scenario.odometerReading,
      odometerAtEffective: scenario.odometerAtEffective,
    },
    claimantInformation: {
      name: scenario.name,
      contactInformation: scenario.contactInformation,
      relationshipToVehicle: scenario.relationshipToVehicle,
    },
    incidentDetails: {
      dateOfLoss: scenario.dateOfLoss,
      descriptionOfIncident: scenario.descriptionOfIncident,
      locationOfIncident: scenario.locationOfIncident,
    },
    repairInformation: {
      repairEstimate: scenario.repairEstimate,
      detailedRepairDescription: scenario.detailedRepairDescription,
      repairShopInformation: scenario.repairShopInformation,
    },
    claimDetails: {
      description: scenario.descriptionOfIncident,
      amount: scenario.repairEstimate,
      documents: Object.values(scenario.attachedDocuments),
      attachedDocuments: scenario.attachedDocuments,
    },
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
}