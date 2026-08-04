import { z } from 'zod';
import { flattenAttachedDocuments } from '@/lib/claim-documents';
import { parsePolicyNumber } from '@/lib/contracts/policy-patterns';
import { CONTRACT_TYPES } from '@/lib/contracts/types';
import { isAllowedClaimDocumentUrl } from '@/lib/document-urls';

const truthyFlag = z
  .union([z.boolean(), z.enum(['true', 'on', '1', 'yes'])])
  .optional()
  .transform((value) => {
    if (value === true) return true;
    if (typeof value === 'string') {
      return ['true', 'on', '1', 'yes'].includes(value.toLowerCase());
    }
    return false;
  });

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
  odometerAtEffective: z.coerce.number().nonnegative().optional(),
  name: z.string().min(1),
  contactInformation: z.string().min(1),
  relationshipToVehicle: z.string().min(1),
  dateOfLoss: z.coerce.date(),
  descriptionOfIncident: z.string().min(1),
  locationOfIncident: z.string().min(1),
  repairEstimate: z.coerce.number().positive(),
  detailedRepairDescription: z.string().min(1),
  repairShopInformation: z.string().min(1),
  /**
   * Opt out of Prior Claims History when the vehicle/claimant has none.
   * Checkbox / flag — not a file upload.
   */
  priorClaimsHistoryNone: truthyFlag,
  /** FWIS linkage when claim was imported via API (preferred over screenshots). */
  fwisClaimId: z.string().optional(),
  fwisContractNumber: z.string().optional(),
  fwisClaimNumber: z.string().optional(),
  dataSource: z.enum(['fwis', 'manual', 'screenshot']).optional(),
});

export type ParsedClaimForm = z.infer<typeof claimFormSchema>;

export const FILE_FIELDS = [
  'proofOfOwnership',
  'maintenanceRecords',
  'priorClaimsHistory',
  'inspectionReports',
  'serviceHistory',
] as const;

export type FileField = (typeof FILE_FIELDS)[number];

const documentUrlOrList = z.union([
  z.string().url(),
  z.array(z.string().url()).min(1),
]);

export const claimJsonSchema = claimFormSchema.extend({
  documents: z
    .record(documentUrlOrList)
    .default({})
    .superRefine((documents, ctx) => {
      for (const [field, value] of Object.entries(documents)) {
        const urls = Array.isArray(value) ? value : [value];
        for (const [i, url] of urls.entries()) {
          if (!isAllowedClaimDocumentUrl(url)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Document URL for "${field}" is not from an allowed upload source.`,
              path: Array.isArray(value) ? [field, i] : [field],
            });
          }
        }
      }
    }),
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

/** Collect one or more files per document slot (supports multi-select inputs). */
export function extractFilesFromFormData(
  formData: FormData
): Record<string, File[]> {
  const files: Record<string, File[]> = {};

  for (const field of FILE_FIELDS) {
    const values = formData
      .getAll(field)
      .filter((value): value is File => value instanceof File && value.size > 0);
    if (values.length > 0) {
      files[field] = values;
    }
  }

  return files;
}

export function flattenUploadedFiles(
  files: Record<string, File | File[]>
): Array<{ field: string; file: File }> {
  const out: Array<{ field: string; file: File }> = [];
  for (const [field, value] of Object.entries(files)) {
    const list = Array.isArray(value) ? value : value ? [value] : [];
    for (const file of list) {
      if (file && file.size > 0) out.push({ field, file });
    }
  }
  return out;
}

export function validateUploadedFileSizes(
  files: Record<string, File | File[]>
): void {
  for (const { field, file } of flattenUploadedFiles(files)) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `${FILE_FIELD_LABELS[field as (typeof FILE_FIELDS)[number]] ?? field} exceeds the 10 MB limit.`
      );
    }
  }
}

/** Drop empty strings so optional fields and coerce.number don't misfire. */
function normalizeClaimInput(
  raw: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === '' || value === null || value === undefined) {
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function parseClaimFormData(formData: FormData): ParsedClaimForm {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).filter(([, value]) => typeof value === 'string')
  );

  return claimFormSchema.parse(normalizeClaimInput(raw));
}

export function parseClaimJson(body: unknown): ParsedClaimJson {
  if (!body || typeof body !== 'object') {
    return claimJsonSchema.parse(body);
  }
  const { documents, ...rest } = body as Record<string, unknown>;
  return claimJsonSchema.parse({
    ...normalizeClaimInput(rest),
    ...(documents !== undefined ? { documents } : {}),
  });
}

export function buildClaimDocument(
  parsed: ParsedClaimForm,
  documentPaths: Record<string, string | string[]>
) {
  const policyParsed = parsePolicyNumber(parsed.policyNumber);
  const contractType = policyParsed.valid
    ? policyParsed.contractType
    : parsed.contractType;
  const contractVariant = policyParsed.valid
    ? policyParsed.variant
    : parsed.contractVariant;
  const contractTypeSource: 'policy_number' | 'manual' = policyParsed.valid
    ? 'policy_number'
    : 'manual';

  const dataSource =
    parsed.dataSource ??
    (parsed.fwisClaimId || parsed.fwisClaimNumber ? 'fwis' : 'manual');

  const documentWaivers =
    parsed.priorClaimsHistoryNone && !documentPaths.priorClaimsHistory
      ? {
          priorClaimsHistory: {
            reason: 'none' as const,
            note: 'Attested no prior claims history on file at intake',
            attestedAt: new Date().toISOString(),
          },
        }
      : undefined;

  return {
    policyInformation: {
      policyNumber: parsed.policyNumber,
      contractType,
      contractVariant,
      contractTypeSource:
        dataSource === 'fwis' ? ('policy_number' as const) : contractTypeSource,
      coverageDetails: parsed.coverageDetails,
      policyEffectiveDate: parsed.policyEffectiveDate,
      policyExpirationDate: parsed.policyExpirationDate,
      ...(parsed.fwisContractNumber
        ? { fwisContractNumber: parsed.fwisContractNumber }
        : {}),
    },
    vehicleInfo: {
      make: parsed.make,
      model: parsed.model,
      year: parsed.year,
      vin: parsed.vin,
      odometerReading: parsed.odometerReading,
      ...(parsed.odometerAtEffective != null
        ? { odometerAtEffective: parsed.odometerAtEffective }
        : {}),
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
      dataSource,
      ...(parsed.fwisClaimId ? { fwisClaimId: parsed.fwisClaimId } : {}),
      ...(parsed.fwisClaimNumber
        ? { fwisClaimNumber: parsed.fwisClaimNumber }
        : {}),
      ...(parsed.fwisContractNumber
        ? { fwisContractNumber: parsed.fwisContractNumber }
        : {}),
      amount: parsed.repairEstimate,
      documents: flattenAttachedDocuments(documentPaths),
      attachedDocuments: documentPaths,
      ...(documentWaivers ? { documentWaivers } : {}),
    },
    status: 'pending' as const,
  };
}