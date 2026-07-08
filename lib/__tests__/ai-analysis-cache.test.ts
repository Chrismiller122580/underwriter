import { describe, expect, it } from 'vitest';
import {
  AI_ANALYSIS_MAX_AGE_MS,
  isAiAnalysisFresh,
  shouldReuseAiAnalysis,
} from '@/lib/ai-analysis-cache';
import type { AiAnalysis } from '@/lib/ai-types';

function makeAnalysis(analyzedAt: string): AiAnalysis {
  return {
    summary: 'Test',
    riskScore: 3,
    recommendation: 'approve',
    reasoning: 'OK',
    flags: [],
    fraudIndicators: [],
    confidence: 90,
    contractValid: true,
    waitingPeriodMet: true,
    componentCovered: true,
    maintenanceConcern: null,
    inspectionRecommended: null,
    denialCategory: null,
    informationRequests: [],
    guidelineConflicts: [],
    analyzedAt,
    model: 'test',
  };
}

describe('isAiAnalysisFresh', () => {
  it('returns true for recent analysis', () => {
    const analysis = makeAnalysis(new Date().toISOString());
    expect(isAiAnalysisFresh(analysis)).toBe(true);
  });

  it('returns false for stale analysis', () => {
    const stale = new Date(Date.now() - AI_ANALYSIS_MAX_AGE_MS - 1000).toISOString();
    expect(isAiAnalysisFresh(makeAnalysis(stale))).toBe(false);
  });

  it('returns false for invalid analyzedAt', () => {
    expect(isAiAnalysisFresh(makeAnalysis('not-a-date'))).toBe(false);
  });
});

describe('shouldReuseAiAnalysis', () => {
  it('reuses fresh analysis when not forced', () => {
    const analysis = makeAnalysis(new Date().toISOString());
    expect(shouldReuseAiAnalysis(analysis, false)).toBe(true);
  });

  it('skips reuse when forced', () => {
    const analysis = makeAnalysis(new Date().toISOString());
    expect(shouldReuseAiAnalysis(analysis, true)).toBe(false);
  });

  it('skips reuse when analysis is missing', () => {
    expect(shouldReuseAiAnalysis(undefined, false)).toBe(false);
  });
});