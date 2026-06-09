import { generateObject } from 'ai';
import { z } from 'zod';
import { getVisionModelId, requireXaiProvider } from '@/lib/ai-client';
import { logger } from '@/lib/logger';

export const EXTRACTABLE_FIELDS = [
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
  'relationshipToVehicle',
  'dateOfLoss',
  'descriptionOfIncident',
  'locationOfIncident',
  'repairEstimate',
  'detailedRepairDescription',
  'repairShopInformation',
] as const;

export type ExtractableField = (typeof EXTRACTABLE_FIELDS)[number];

const nullableString = (description: string) =>
  z.union([z.string(), z.null()]).describe(description);

const nullableNumber = (description: string) =>
  z.union([z.number(), z.null()]).describe(description);

export const extractedClaimSchema = z.object({
  policyNumber: nullableString('Policy number, or null if not visible'),
  coverageDetails: nullableString('Coverage details, or null if not visible'),
  policyEffectiveDate: nullableString(
    'Policy effective date as YYYY-MM-DD, or null if not visible'
  ),
  policyExpirationDate: nullableString(
    'Policy expiration date as YYYY-MM-DD, or null if not visible'
  ),
  vin: nullableString('Vehicle VIN, or null if not visible'),
  make: nullableString('Vehicle make, or null if not visible'),
  model: nullableString('Vehicle model, or null if not visible'),
  year: nullableNumber('Vehicle year as a number, or null if not visible'),
  odometerReading: nullableNumber(
    'Odometer reading as a number, or null if not visible'
  ),
  name: nullableString('Claimant name, or null if not visible'),
  contactInformation: nullableString(
    'Claimant contact information, or null if not visible'
  ),
  relationshipToVehicle: nullableString(
    'Relationship to vehicle, or null if not visible'
  ),
  dateOfLoss: nullableString(
    'Date of loss as YYYY-MM-DD, or null if not visible'
  ),
  descriptionOfIncident: nullableString(
    'Description of the incident, or null if not visible'
  ),
  locationOfIncident: nullableString(
    'Location of incident, or null if not visible'
  ),
  repairEstimate: nullableNumber(
    'Repair estimate as a number without $, or null if not visible'
  ),
  detailedRepairDescription: nullableString(
    'Detailed repair description, or null if not visible'
  ),
  repairShopInformation: nullableString(
    'Repair shop information, or null if not visible'
  ),
  fieldsFound: z
    .array(z.string())
    .describe('List of field names successfully extracted from the image'),
  notes: nullableString(
    'Any caveats about unclear or partially visible data, or null if none'
  ),
});

export type ExtractedClaim = z.infer<typeof extractedClaimSchema>;

function normalizeDate(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const [, m, d, y] = usMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return undefined;
}

export function normalizeExtractedClaim(
  raw: ExtractedClaim
): Record<ExtractableField, string> & { notes?: string } {
  const result = {} as Record<ExtractableField, string>;

  for (const field of EXTRACTABLE_FIELDS) {
    const value = raw[field];
    if (value === undefined || value === null || value === '') continue;

    if (
      field === 'policyEffectiveDate' ||
      field === 'policyExpirationDate' ||
      field === 'dateOfLoss'
    ) {
      const normalized = normalizeDate(String(value));
      if (normalized) result[field] = normalized;
      continue;
    }

    result[field] = String(value);
  }

  return result;
}

export type ExtractionResult = {
  fields: Record<string, string>;
  fieldsFound: string[];
  notes?: string;
};

export function mergeExtractionResults(
  results: ExtractionResult[]
): ExtractionResult {
  const fields = {} as Record<ExtractableField, string>;
  const fieldsFoundSet = new Set<string>();
  const notes: string[] = [];

  for (const result of results) {
    for (const field of result.fieldsFound) {
      fieldsFoundSet.add(field);
    }
    if (result.notes?.trim()) {
      notes.push(result.notes.trim());
    }
    for (const field of EXTRACTABLE_FIELDS) {
      const value = result.fields[field];
      if (value && !fields[field]) {
        fields[field] = value;
      }
    }
  }

  return {
    fields,
    fieldsFound: Array.from(fieldsFoundSet),
    notes: notes.length > 0 ? notes.join(' ') : undefined,
  };
}

const EXTRACTION_PROMPT = `You are extracting vehicle warranty claim data from portal screenshot(s).
Read all visible text carefully — labels, form fields, tables, headers.
Extract every field you can find. Use YYYY-MM-DD for dates.
For currency amounts use numbers only (no $ sign).
List every field name you successfully populated in fieldsFound.
Use null for any field that is not visible or unreadable. Add notes for anything ambiguous.`;

const MULTI_IMAGE_PROMPT = `${EXTRACTION_PROMPT}
You may receive multiple images from different portal pages or sections.
Combine information from ALL images — use whichever image has the clearest value for each field.`;

function getVisionModel() {
  const xai = requireXaiProvider();
  return { xai, model: getVisionModelId() };
}

export async function extractClaimFromScreenshot(
  imageBuffer: Buffer,
  mimeType: string
): Promise<ExtractionResult> {
  return extractClaimFromScreenshots([{ buffer: imageBuffer, mimeType }]);
}

export async function extractClaimFromScreenshots(
  images: Array<{ buffer: Buffer; mimeType: string }>
): Promise<ExtractionResult> {
  if (images.length === 0) {
    throw new Error('At least one screenshot is required.');
  }

  const { xai, model } = getVisionModel();
  const prompt = images.length === 1 ? EXTRACTION_PROMPT : MULTI_IMAGE_PROMPT;

  const { object } = await generateObject({
    model: xai(model),
    schema: extractedClaimSchema,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...images.map(({ buffer, mimeType }) => ({
            type: 'image' as const,
            image: `data:${mimeType};base64,${buffer.toString('base64')}`,
          })),
        ],
      },
    ],
  });

  const fields = normalizeExtractedClaim(object);
  const fieldsFound = object.fieldsFound ?? Object.keys(fields);

  logger.info('Screenshot extraction complete', {
    imageCount: images.length,
    fieldsFound: fieldsFound.length,
    model,
  });

  return {
    fields,
    fieldsFound,
    notes: object.notes ?? undefined,
  };
}