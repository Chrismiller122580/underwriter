import { describe, expect, it } from 'vitest';
import {
  AUTO_APPROVE_MAX_RISK,
  AUTO_APPROVE_MIN_CONFIDENCE,
  checkAutoApproveGuardrails,
} from '@/lib/underwriting-guardrails';

describe('checkAutoApproveGuardrails', () => {
  const clean = {
    riskScore: 2,
    confidence: 90,
    fraudIndicators: [] as string[],
    informationRequests: [] as string[],
    guidelineConflicts: [] as string[],
    recommendation: 'approve' as const,
  };

  it('allows clean low-risk approve', () => {
    expect(checkAutoApproveGuardrails(clean).allowed).toBe(true);
  });

  it('blocks at risk boundary', () => {
    const result = checkAutoApproveGuardrails({
      ...clean,
      riskScore: AUTO_APPROVE_MAX_RISK + 1,
    });
    expect(result.allowed).toBe(false);
  });

  it('allows risk exactly at max', () => {
    const result = checkAutoApproveGuardrails({
      ...clean,
      riskScore: AUTO_APPROVE_MAX_RISK,
    });
    expect(result.allowed).toBe(true);
  });

  it('blocks below confidence minimum', () => {
    const result = checkAutoApproveGuardrails({
      ...clean,
      confidence: AUTO_APPROVE_MIN_CONFIDENCE - 1,
    });
    expect(result.allowed).toBe(false);
  });
});
