import { describe, expect, it } from 'vitest';
import { parseClaimJson } from '@/lib/parse-claim-form';

const validBase = {
  policyNumber: 'V123456',
  contractType: 'vital' as const,
  contractVariant: 'standard' as const,
  coverageDetails: 'Vital coverage',
  policyEffectiveDate: '2024-01-01',
  policyExpirationDate: '2026-01-01',
  vin: '1HGBH41JXMN109186',
  make: 'Honda',
  model: 'Accord',
  year: '2020',
  odometerReading: '45000',
  name: 'Jane Doe',
  contactInformation: 'jane@example.com',
  relationshipToVehicle: 'Owner',
  dateOfLoss: '2025-03-01',
  descriptionOfIncident: 'Engine noise',
  locationOfIncident: 'Dallas, TX',
  repairEstimate: '1500',
  detailedRepairDescription: 'Replace timing chain',
  repairShopInformation: 'Main Street Auto',
  dataSource: 'manual' as const,
};

describe('parseClaimJson', () => {
  it('accepts a complete claim without documents', () => {
    const parsed = parseClaimJson(validBase);
    expect(parsed.policyNumber).toBe('V123456');
    expect(parsed.documents).toEqual({});
  });

  it('accepts priorClaimsHistoryNone opt-out flag', () => {
    const parsed = parseClaimJson({
      ...validBase,
      priorClaimsHistoryNone: true,
    });
    expect(parsed.priorClaimsHistoryNone).toBe(true);
  });

  it('accepts checkbox-style priorClaimsHistoryNone string', () => {
    const parsed = parseClaimJson({
      ...validBase,
      priorClaimsHistoryNone: 'on',
    });
    expect(parsed.priorClaimsHistoryNone).toBe(true);
  });

  it('ignores empty optional fields', () => {
    const parsed = parseClaimJson({
      ...validBase,
      odometerAtEffective: '',
      fwisClaimId: '',
      fwisClaimNumber: '',
    });
    expect(parsed.odometerAtEffective).toBeUndefined();
    expect(parsed.fwisClaimId).toBeUndefined();
  });

  it('accepts allowed blob document URLs under claims/', () => {
    const parsed = parseClaimJson({
      ...validBase,
      documents: {
        proofOfOwnership:
          'https://abc.public.blob.vercel-storage.com/claims/intake/uuid/proof.pdf',
      },
    });
    expect(parsed.documents.proofOfOwnership).toContain('/claims/');
  });

  it('rejects document URLs outside allowed hosts/paths', () => {
    expect(() =>
      parseClaimJson({
        ...validBase,
        documents: {
          proofOfOwnership: 'https://evil.example.com/claims/proof.pdf',
        },
      })
    ).toThrow();

    expect(() =>
      parseClaimJson({
        ...validBase,
        documents: {
          // Host OK but missing /claims/ path (old client upload bug)
          proofOfOwnership:
            'https://abc.public.blob.vercel-storage.com/proof.pdf',
        },
      })
    ).toThrow();
  });
});
