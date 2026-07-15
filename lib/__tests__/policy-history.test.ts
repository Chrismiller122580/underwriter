import { describe, expect, it } from 'vitest';
import {
  buildPolicyHistoryContext,
  type RelatedClaimSummary,
} from '@/lib/policy-history';

function peer(
  overrides: Partial<RelatedClaimSummary> & { id: string; amount: number; status: string }
): RelatedClaimSummary {
  return {
    policyNumber: 'FWVL000001',
    vin: '1HGCM82633A004352',
    repairDescription: 'Alternator replacement',
    dateOfLoss: '2025-01-01',
    createdAt: '2025-01-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildPolicyHistoryContext', () => {
  it('sums approved aggregate and detects LOL breach for Vital ($10k max)', () => {
    const history = buildPolicyHistoryContext(
      'FWVL000001',
      'vital',
      3000,
      [
        peer({ id: 'a', amount: 8000, status: 'approved' }),
        peer({ id: 'b', amount: 500, status: 'denied' }),
      ]
    );

    expect(history.approvedAggregate).toBe(8000);
    expect(history.maxAggregate).toBe(10_000);
    expect(history.remainingAfterApproved).toBe(2000);
    expect(history.wouldExceedAggregate).toBe(true);
  });

  it('does not flag breach when room remains', () => {
    const history = buildPolicyHistoryContext('FWCL000001', 'classic', 2000, [
      peer({ id: 'a', amount: 5000, status: 'approved', policyNumber: 'FWCL000001' }),
    ]);

    expect(history.maxAggregate).toBe(40_000);
    expect(history.wouldExceedAggregate).toBe(false);
    expect(history.remainingAfterApproved).toBe(35_000);
  });

  it('tracks open peer aggregate separately', () => {
    const history = buildPolicyHistoryContext('FWVL000001', 'vital', 1000, [
      peer({ id: 'a', amount: 4000, status: 'approved' }),
      peer({ id: 'b', amount: 3000, status: 'pending' }),
      peer({ id: 'c', amount: 2000, status: 'under_review' }),
    ]);

    expect(history.approvedAggregate).toBe(4000);
    expect(history.openAggregate).toBe(5000);
    expect(history.remainingConservative).toBe(1000);
  });

  it('collects prior approved repair descriptions', () => {
    const history = buildPolicyHistoryContext('FWVL000001', 'vital', 500, [
      peer({
        id: 'a',
        amount: 1000,
        status: 'approved',
        repairDescription: 'Engine cylinder head gasket',
      }),
    ]);

    expect(history.priorApprovedRepairs).toEqual([
      'Engine cylinder head gasket',
    ]);
  });
});
