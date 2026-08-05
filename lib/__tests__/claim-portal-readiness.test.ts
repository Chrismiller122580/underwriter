import { describe, expect, it } from 'vitest';
import { getUnderwritingReadiness } from '@/lib/claim-portal';
import type { ClaimRecord } from '@/lib/claims-store';

function baseClaim(overrides: Partial<ClaimRecord> = {}): ClaimRecord {
  return {
    _id: '11111111-1111-1111-1111-111111111111',
    policyInformation: {
      policyNumber: 'V123456',
      contractType: 'vital',
      contractVariant: 'standard',
      coverageDetails: 'Vital',
      policyEffectiveDate: '2024-01-01',
      policyExpirationDate: '2027-01-01',
    },
    vehicleInfo: {
      make: 'Honda',
      model: 'Accord',
      year: 2020,
      vin: '1HGBH41JXMN109186',
      odometerReading: 45000,
    },
    claimantInformation: {
      name: 'Jane Doe',
      contactInformation: 'jane@example.com',
      relationshipToVehicle: 'Owner',
    },
    incidentDetails: {
      dateOfLoss: '2025-06-01',
      descriptionOfIncident: 'Engine failure while driving on highway',
      locationOfIncident: 'Dallas, TX',
    },
    repairInformation: {
      repairEstimate: 4200,
      detailedRepairDescription: 'Engine internal repair / cylinder head',
      repairShopInformation: 'Main Street Auto',
    },
    claimDetails: {
      description: 'Engine failure while driving on highway',
      amount: 4200,
      documents: [],
      attachedDocuments: {},
    },
    status: 'pending',
    aiAnalysis: {
      summary: 'Test',
      riskScore: 6,
      recommendation: 'review',
      reasoning: 'Needs docs',
      flags: [],
      fraudIndicators: [],
      confidence: 70,
      contractValid: true,
      waitingPeriodMet: true,
      componentCovered: true,
      maintenanceConcern: true,
      inspectionRecommended: true,
      denialCategory: null,
      informationRequests: [
        'Maintenance records',
        'Inspection report',
        'Service history',
      ],
      guidelineConflicts: ['Maintenance validation incomplete'],
      analyzedAt: new Date().toISOString(),
      model: 'test',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('getUnderwritingReadiness — supporting documents', () => {
  it('flags no documents and guides staff to upload', () => {
    const readiness = getUnderwritingReadiness(baseClaim());
    expect(
      readiness.warnings.some((w) =>
        w.includes('No supporting documents attached')
      )
    ).toBe(true);
    expect(readiness.nextAction.toLowerCase()).toMatch(/upload supporting documents/);
    expect(readiness.tone).toBe('review');
  });

  it('notes partial missing document slots', () => {
    const readiness = getUnderwritingReadiness(
      baseClaim({
        claimDetails: {
          description: 'Engine failure',
          amount: 4200,
          documents: ['uploads/x/proof.pdf'],
          attachedDocuments: {
            proofOfOwnership: 'uploads/11111111-1111-1111-1111-111111111111/proof.pdf',
          },
        },
      })
    );
    expect(
      readiness.warnings.some((w) => w.includes('still empty'))
    ).toBe(true);
  });

  it('does not warn about empty slots when all documents are attached', () => {
    const attached = {
      repairOrder: 'uploads/11111111-1111-1111-1111-111111111111/ro.pdf',
      proofOfOwnership: 'uploads/11111111-1111-1111-1111-111111111111/a.pdf',
      maintenanceRecords: 'uploads/11111111-1111-1111-1111-111111111111/b.pdf',
      priorClaimsHistory: 'uploads/11111111-1111-1111-1111-111111111111/c.pdf',
      inspectionReports: 'uploads/11111111-1111-1111-1111-111111111111/d.pdf',
      serviceHistory: 'uploads/11111111-1111-1111-1111-111111111111/e.pdf',
    };
    const readiness = getUnderwritingReadiness(
      baseClaim({
        claimDetails: {
          description: 'Engine failure',
          amount: 4200,
          documents: Object.values(attached),
          attachedDocuments: attached,
        },
        aiAnalysis: {
          summary: 'Test',
          riskScore: 2,
          recommendation: 'approve',
          reasoning: 'Clean',
          flags: [],
          fraudIndicators: [],
          confidence: 90,
          contractValid: true,
          waitingPeriodMet: true,
          componentCovered: true,
          maintenanceConcern: false,
          inspectionRecommended: false,
          denialCategory: null,
          informationRequests: [],
          guidelineConflicts: [],
          analyzedAt: new Date().toISOString(),
          model: 'test',
        },
      })
    );
    expect(
      readiness.warnings.some(
        (w) =>
          w.includes('No supporting documents') || w.includes('still empty')
      )
    ).toBe(false);
  });
});
