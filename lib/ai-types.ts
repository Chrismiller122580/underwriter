import { z } from 'zod';

export const aiAnalysisSchema = z.object({
  summary: z.string().describe('2-3 sentence claim summary for the adjuster'),
  riskScore: z.number().min(1).max(10).describe('1=low risk, 10=high risk'),
  recommendation: z.enum(['approve', 'deny', 'review']),
  reasoning: z.string().describe('Clear explanation of the recommendation'),
  flags: z.array(z.string()).describe('Specific concerns or inconsistencies'),
  fraudIndicators: z.array(z.string()).describe('Potential fraud signals, empty if none'),
  confidence: z.number().min(0).max(100).describe('Confidence in the assessment'),
});

export type AiAnalysis = z.infer<typeof aiAnalysisSchema> & {
  analyzedAt: string;
  model: string;
};