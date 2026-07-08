import { describe, expect, it } from 'vitest';
import type { ClaimRecord } from '@/lib/claims-store';
import { evaluateContractRules } from '@/lib/contract-rules';

function makeClaim(overrides: Partial<ClaimRecord> = {}): ClaimRecord {
  const now = new Date().toISOString();

  return {
    _id: 'test-claim',
    policyInformation: {
      policyNumber: 'FWVL000001',
      contractType: 'vital',
      contractVariant: 'standard',
      contractTypeSource: 'policy_number',
      coverageDetails: 'Freedom Vital',
      policyEffectiveDate: '2024-01-01',
      policyExpirationDate: '2028-01-01',
    },
    vehicleInfo: {
      make: 'Honda',
      model: 'Accord',
      year: 2020,
      vin: '1HGCM82633A004352',
      odometerReading: 45000,
      odometerAtEffective: 40000,
    },
    claimantInformation: {
      name: 'Test Claimant',
      contactInformation: 'test@example.com',
      relationshipToVehicle: 'Owner',
    },
    incidentDetails: {
      dateOfLoss: '2025-06-01',
      descriptionOfIncident: 'Engine issue',
      locationOfIncident: 'Atlanta, GA',
    },
    repairInformation: {
      repairEstimate: 1200,
      detailedRepairDescription: 'Alternator replacement',
      repairShopInformation: 'Test Shop',
    },
    claimDetails: {
      description: 'Engine issue',
      amount: 1200,
      documents: [],
    },
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('evaluateContractRules', () => {
  it('denies when waiting-period days are not met', () => {
    const result = evaluateContractRules(
      makeClaim({
        incidentDetails: {
          dateOfLoss: '2024-01-15',
          descriptionOfIncident: 'Engine issue',
          locationOfIncident: 'Atlanta, GA',
        },
      })
    );

    expect(result.decision).toBe('denied');
    expect(result.denialCategory).toBe('waiting_period');
  });

  it('denies when waiting-period miles are not met', () => {
    const result = evaluateContractRules(
      makeClaim({
        vehicleInfo: {
          make: 'Honda',
          model: 'Accord',
          year: 2020,
          vin: '1HGCM82633A004352',
          odometerReading: 40500,
          odometerAtEffective: 40000,
        },
      })
    );

    expect(result.decision).toBe('denied');
    expect(result.denialCategory).toBe('waiting_period');
    expect(result.reason).toContain('miles');
  });

  it('returns pending when odometer at policy start is missing', () => {
    const result = evaluateContractRules(
      makeClaim({
        vehicleInfo: {
          make: 'Honda',
          model: 'Accord',
          year: 2020,
          vin: '1HGCM82633A004352',
          odometerReading: 45000,
        },
      })
    );

    expect(result.decision).toBe('pending');
  });

  it('approves when days and miles waiting periods are satisfied', () => {
    const result = evaluateContractRules(makeClaim());
    expect(result.decision).toBe('approved');
  });
});