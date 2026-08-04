import { describe, expect, it } from 'vitest';
import { combineDecisions } from '@/lib/ai-underwrite';
import type { AiAnalysis } from '@/lib/ai-types';
import {
  buildGuidelineSkip,
  getActiveGuidelineConflicts,
  isGuidelineSkipped,
  isMaintenanceGuidelineConflict,
  mergeGuidelineSkip,
} from '@/lib/guideline-skips';

const maintenanceConflict =
  'Missing verifiable maintenance data prevents confident approval of major component claim per underwriting rules';

function analysis(overrides: Partial<AiAnalysis> = {}): AiAnalysis {
  return {
    summary: 'Test',
    riskScore: 4,
    recommendation: 'review',
    reasoning: 'Needs maintenance docs',
    flags: [],
    fraudIndicators: [],
    confidence: 85,
    contractValid: true,
    waitingPeriodMet: true,
    componentCovered: true,
    maintenanceConcern: true,
    inspectionRecommended: null,
    denialCategory: null,
    informationRequests: [],
    guidelineConflicts: [maintenanceConflict],
    analyzedAt: new Date().toISOString(),
    model: 'test',
    ...overrides,
  };
}

describe('guideline skips', () => {
  it('matches maintenance wording flexibly for helpers', () => {
    expect(isMaintenanceGuidelineConflict(maintenanceConflict)).toBe(true);
    expect(
      isMaintenanceGuidelineConflict('Fraud ring pattern detected')
    ).toBe(false);
  });

  it('filters skipped concerns from active list', () => {
    const skip = buildGuidelineSkip(maintenanceConflict, {
      note: 'Shop confirmed service',
    });
    expect(getActiveGuidelineConflicts([maintenanceConflict], [skip])).toEqual(
      []
    );
    expect(isGuidelineSkipped([skip], maintenanceConflict)).toBe(true);
  });

  it('merges skips without duplicates', () => {
    const first = buildGuidelineSkip(maintenanceConflict);
    const second = buildGuidelineSkip(maintenanceConflict, {
      note: 'updated note',
    });
    const merged = mergeGuidelineSkip([first], second);
    expect(merged).toHaveLength(1);
    expect(merged[0].note).toBe('updated note');
  });

  it('lets underwrite approve when only guideline review was from skipped concerns', () => {
    const skip = buildGuidelineSkip(maintenanceConflict, {
      note: 'Shop confirmed maintenance',
    });
    const result = combineDecisions(
      'approved',
      analysis({ riskScore: 3, confidence: 90, recommendation: 'review' }),
      { guidelineSkips: [skip] }
    );
    expect(result.decision).toBe('approved');
    expect(result.reason).not.toContain(maintenanceConflict);
    expect(result.reason.toLowerCase()).toContain('skipped guideline');
  });

  it('still holds when guideline is not skipped', () => {
    const result = combineDecisions('approved', analysis());
    expect(result.decision).toBe('under_review');
    expect(result.reason).toContain('Guideline concerns');
  });
});
