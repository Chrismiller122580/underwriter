import { describe, expect, it } from 'vitest';
import type { ClaimRecord } from '@/lib/claims-store';
import { matchesLastName, toPublicClaimStatus } from '@/lib/public-status';

function makeClaim(overrides: Partial<ClaimRecord> = {}): ClaimRecord {
  const now = new Date().toISOString();
  return {
    _id: '11111111-1111-4111-8111-111111111111',
    publicToken: 'AB12CD34EF',
    policyInformation: {
      policyNumber: 'FWVL041518',
      contractType: 'vital',
      coverageDetails: 'Vital',
      policyEffectiveDate: '2024-01-01',
      policyExpirationDate: '2028-01-01',
    },
    vehicleInfo: {
      make: 'Honda',
      model: 'Accord',
      year: 2020,
      vin: '1HGCM82633A004352',
      odometerReading: 45000,
    },
    claimantInformation: {
      name: 'Jane Smith',
      contactInformation: 'jane@example.com',
      relationshipToVehicle: 'Owner',
    },
    incidentDetails: {
      dateOfLoss: '2025-06-01',
      descriptionOfIncident: 'Noise',
      locationOfIncident: 'Atlanta',
    },
    repairInformation: {
      repairEstimate: 1200,
      detailedRepairDescription: 'Alternator',
      repairShopInformation: 'Shop',
    },
    claimDetails: {
      description: 'x',
      amount: 1200,
      documents: [],
    },
    status: 'needs_info',
    infoRequest: {
      items: ['Maintenance records'],
      requestedAt: now,
      source: 'manual',
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('matchesLastName', () => {
  it('matches full name last token', () => {
    expect(matchesLastName('Jane Smith', 'Smith')).toBe(true);
    expect(matchesLastName('Jane Smith', 'jones')).toBe(false);
  });
});

describe('toPublicClaimStatus', () => {
  it('redacts policy to last 4 and exposes open info requests', () => {
    const pub = toPublicClaimStatus(makeClaim());
    expect(pub.trackingCode).toBe('AB12CD34EF');
    expect(pub.policyLast4).toBe('1518');
    expect(pub.infoRequests).toEqual(['Maintenance records']);
    expect(pub.statusLabel).toMatch(/information/i);
  });

  it('omits info requests when not needs_info', () => {
    const pub = toPublicClaimStatus(makeClaim({ status: 'pending' }));
    expect(pub.infoRequests).toBeNull();
  });
});
