import type { AiAnalysis } from '@/lib/ai-types';

/** Reuse AI scan results for underwrite when younger than this. */
export const AI_ANALYSIS_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function isAiAnalysisFresh(
  analysis: AiAnalysis,
  maxAgeMs = AI_ANALYSIS_MAX_AGE_MS
): boolean {
  const analyzedAt = Date.parse(analysis.analyzedAt);
  if (Number.isNaN(analyzedAt)) return false;
  return Date.now() - analyzedAt < maxAgeMs;
}

export function shouldReuseAiAnalysis(
  analysis: AiAnalysis | undefined,
  force = false,
  maxAgeMs = AI_ANALYSIS_MAX_AGE_MS
): analysis is AiAnalysis {
  if (force || !analysis) return false;
  return isAiAnalysisFresh(analysis, maxAgeMs);
}