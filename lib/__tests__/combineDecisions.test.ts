import { describe, expect, it } from 'vitest';
import { combineDecisions } from '@/lib/ai-underwrite';
import type { AiAnalysis } from '@/lib/ai-types';
import {
  AUTO_APPROVE_MAX_RISK,
  AUTO_APPROVE_MIN_CONFIDENCE,
} from '@/lib/underwriting-guardrails';

function makeAnalysis(overrides: Partial<AiAnalysis> = {}): AiAnalysis {
  return {
    summary: 'Test claim',
    riskScore: 2,
    recommendation: 'approve',
    reasoning: 'Looks fine.',
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
    analyzedAt: new Date().toISOString(),
    model: 'test',
    ...overrides,
  };
}

describe('combineDecisions', () => {
  it('returns denied when rules deny regardless of AI', () => {
    const result = combineDecisions(
      'denied',
      makeAnalysis({ recommendation: 'approve' })
    );
    expect(result.decision).toBe('denied');
  });

  it('returns under_review when rules are pending even if AI approves', () => {
    const result = combineDecisions(
      'pending',
      makeAnalysis({ recommendation: 'approve' })
    );
    expect(result.decision).toBe('under_review');
  });

  it('returns denied when AI recommends deny', () => {
    const result = combineDecisions(
      'approved',
      makeAnalysis({ recommendation: 'deny' })
    );
    expect(result.decision).toBe('denied');
  });

  it('returns under_review when AI requests more information', () => {
    const result = combineDecisions(
      'approved',
      makeAnalysis({ informationRequests: ['Maintenance records'] })
    );
    expect(result.decision).toBe('under_review');
  });

  it('returns approved when rules pass and AI approves cleanly within guardrails', () => {
    const result = combineDecisions(
      'approved',
      makeAnalysis({ recommendation: 'approve' })
    );
    expect(result.decision).toBe('approved');
  });

  it('blocks auto-approve when risk exceeds guardrail', () => {
    const result = combineDecisions(
      'approved',
      makeAnalysis({
        recommendation: 'approve',
        riskScore: AUTO_APPROVE_MAX_RISK + 1,
        confidence: 95,
      })
    );
    expect(result.decision).toBe('under_review');
    expect(result.reason).toMatch(/Auto-approve blocked/i);
    expect(result.reason).toMatch(/Risk score/i);
  });

  it('blocks auto-approve when confidence is too low', () => {
    const result = combineDecisions(
      'approved',
      makeAnalysis({
        recommendation: 'approve',
        riskScore: 2,
        confidence: AUTO_APPROVE_MIN_CONFIDENCE - 1,
      })
    );
    expect(result.decision).toBe('under_review');
    expect(result.reason).toMatch(/Confidence/i);
  });

  it('blocks auto-approve when fraud indicators are present', () => {
    const result = combineDecisions(
      'approved',
      makeAnalysis({
        recommendation: 'approve',
        fraudIndicators: ['Suspicious language'],
      })
    );
    expect(result.decision).toBe('under_review');
    expect(result.reason).toMatch(/Fraud indicators/i);
  });
});
