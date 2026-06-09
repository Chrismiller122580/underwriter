import { z } from 'zod';
import { CONTRACT_TYPES } from '@/lib/contracts/types';

const claimFormSchema = z.object({
  policyNumber: z.string().min(1),
  contractType: z.enum([...CONTRACT_TYPES, 'unknown']).default('unknown'),
  contractVariant: z
    .enum(['standard', 'manufacturer_extension'])
    .default('standard'),
  coverageDetails: z.string().min(1),
  policyEffectiveDate: z.coerce.date(),
  policyExpirationDate: z.coerce.date(),
  vin: z.string().min(1),
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.coerce.number().int().min(1900).max(2100),
  odometerReading: z.coerce.number().nonnegative(),
  name: z.string().min(1),
  contactInformation: z.string().min(1),
  relationshipToVehicle: z.string().min(1),
  dateOfLoss: z.coerce.date(),
  descriptionOfIncident: z.string().min(1),
  locationOfIncident: z.string().min(1),
  repairEstimate: z.coerce.number().positive(),
  detailedRepairDescription: z.string().min(1),
  repairShopInformation: z.string().min(1),
});

export type ParsedClaimForm = z.infer<typeof claimFormSchema>;

export const FILE_FIELDS = [
  'proofOfOwnership',
  'maintenanceRecords',
  'priorClaimsHistory',
  'inspectionReports',
  'serviceHistory',
] as const;

export const claimJsonSchema = claimFormSchema.extend({
  documents: z.record(z.string().url()).refine(
    (docs) => FILE_FIELDS.every((field) => docs[field]),
    { message: 'All document fields are required.' }
  ),
});

export type ParsedClaimJson = z.infer<typeof claimJsonSchema>;

export const FILE_FIELD_LABELS: Record<(typeof FILE_FIELDS)[number], string> = {
  proofOfOwnership: 'Proof of Ownership',
  maintenanceRecords: 'Maintenance Records',
  priorClaimsHistory: 'Prior Claims History',
  inspectionReports: 'Inspection Reports',
  serviceHistory: 'Service History',
};

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export function extractFilesFromFormData(
  formData: FormData
): Record<string, File> {
  const files: Record<string, File> = {};

  for (const field of FILE_FIELDS) {
    const value = formData.get(field);
    if (value instanceof File && value.size > 0) {
      files[field] = value;
    }
  }

  return files;
}

export function parseClaimFormData(formData: FormData): ParsedClaimForm {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).filter(([, value]) => typeof value === 'string')
  );

  return claimFormSchema.parse(raw);
}

export function parseClaimJson(body: unknown): ParsedClaimJson {
  return claimJsonSchema.parse(body);
}

export function buildClaimDocument(
  parsed: ParsedClaimForm,
  documentPaths: Record<string, string>
) {
  return {
    policyInformation: {
      policyNumber: parsed.policyNumber,
      contractType: parsed.contractType,
      contractVariant: parsed.contractVariant,
      contractTypeSource: 'policy_number' as const,
      coverageDetails: parsed.coverageDetails,
      policyEffectiveDate: parsed.policyEffectiveDate,
      policyExpirationDate: parsed.policyExpirationDate,
    },
    vehicleInfo: {
      make: parsed.make,
      model: parsed.model,
      year: parsed.year,
      vin: parsed.vin,
      odometerReading: parsed.odometerReading,
    },
    claimantInformation: {
      name: parsed.name,
      contactInformation: parsed.contactInformation,
      relationshipToVehicle: parsed.relationshipToVehicle,
    },
    incidentDetails: {
      dateOfLoss: parsed.dateOfLoss,
      descriptionOfIncident: parsed.descriptionOfIncident,
      locationOfIncident: parsed.locationOfIncident,
    },
    repairInformation: {
      repairEstimate: parsed.repairEstimate,
      detailedRepairDescription: parsed.detailedRepairDescription,
      repairShopInformation: parsed.repairShopInformation,
    },
    claimDetails: {
      description: parsed.descriptionOfIncident,
      amount: parsed.repairEstimate,
      documents: Object.values(documentPaths),
    },
    status: 'pending' as const,
  };
}