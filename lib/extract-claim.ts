import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
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

export const extractedClaimSchema = z.object({
  policyNumber: z.string().optional(),
  coverageDetails: z.string().optional(),
  policyEffectiveDate: z.string().optional().describe('YYYY-MM-DD format'),
  policyExpirationDate: z.string().optional().describe('YYYY-MM-DD format'),
  vin: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().optional(),
  odometerReading: z.coerce.number().optional(),
  name: z.string().optional(),
  contactInformation: z.string().optional(),
  relationshipToVehicle: z.string().optional(),
  dateOfLoss: z.string().optional().describe('YYYY-MM-DD format'),
  descriptionOfIncident: z.string().optional(),
  locationOfIncident: z.string().optional(),
  repairEstimate: z.coerce.number().optional(),
  detailedRepairDescription: z.string().optional(),
  repairShopInformation: z.string().optional(),
  fieldsFound: z
    .array(z.string())
    .describe('List of field names successfully extracted from the image'),
  notes: z
    .string()
    .optional()
    .describe('Any caveats about unclear or partially visible data'),
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

export async function extractClaimFromScreenshot(
  imageBuffer: Buffer,
  mimeType: string
): Promise<{
  fields: Record<string, string>;
  fieldsFound: string[];
  notes?: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is required for screenshot autofill. Add it in Vercel env settings.'
    );
  }

  const model = process.env.AI_VISION_MODEL ?? process.env.AI_MODEL ?? 'gpt-4o-mini';
  const openai = createOpenAI({ apiKey });
  const base64 = imageBuffer.toString('base64');

  const { object } = await generateObject({
    model: openai(model),
    schema: extractedClaimSchema,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You are extracting vehicle warranty claim data from a portal screenshot.
Read all visible text carefully — labels, form fields, tables, headers.
Extract every field you can find. Use YYYY-MM-DD for dates.
For currency amounts use numbers only (no $ sign).
List every field name you successfully populated in fieldsFound.
Leave fields blank if not visible or unreadable. Add notes for anything ambiguous.`,
          },
          {
            type: 'image',
            image: `data:${mimeType};base64,${base64}`,
          },
        ],
      },
    ],
  });

  const fields = normalizeExtractedClaim(object);
  const fieldsFound = object.fieldsFound ?? Object.keys(fields);

  logger.info('Screenshot extraction complete', {
    fieldsFound: fieldsFound.length,
    model,
  });

  return {
    fields,
    fieldsFound,
    notes: object.notes,
  };
}