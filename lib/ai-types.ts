import { z } from 'zod';

const nullableBool = (description: string) =>
  z.union([z.boolean(), z.null()]).describe(description);

const nullableDenialCategory = z
  .union([
    z.enum([
      'waiting_period',
      'non_covered',
      'invalid_contract',
      'maintenance',
      'limit_exceeded',
    ]),
    z.null(),
  ])
  .describe('Primary denial category if recommending deny, else null');

export const aiAnalysisSchema = z.object({
  summary: z.string().describe('2-3 sentence claim summary for the adjuster'),
  riskScore: z.number().min(1).max(10).describe('1=low risk, 10=high risk'),
  recommendation: z.enum(['approve', 'deny', 'review']),
  reasoning: z.string().describe('Clear explanation per Freedom Warranty guidelines'),
  flags: z.array(z.string()).describe('Specific concerns or inconsistencies'),
  fraudIndicators: z.array(z.string()).describe('Potential fraud signals, empty if none'),
  confidence: z.number().min(0).max(100).describe('Confidence in the assessment'),
  contractValid: nullableBool('Whether the contract appears valid and active'),
  waitingPeriodMet: nullableBool('Whether waiting period requirements appear met'),
  componentCovered: nullableBool('Whether requested repair appears covered for this contract type'),
  maintenanceConcern: nullableBool('Whether maintenance record concerns exist'),
  inspectionRecommended: nullableBool('Whether inspection is recommended per guidelines'),
  denialCategory: nullableDenialCategory,
});

export type AiAnalysis = z.infer<typeof aiAnalysisSchema> & {
  analyzedAt: string;
  model: string;
};