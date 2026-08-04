import { describe, expect, it } from 'vitest';
import { getMissingDocuments, getWaivedDocuments } from '@/lib/claim-portal';
import {
  buildDocumentWaiver,
  isDocumentSlotSatisfied,
  isDocumentWaived,
} from '@/lib/document-waivers';
import { buildClaimDocument, parseClaimJson } from '@/lib/parse-claim-form';
import type { ClaimRecord } from '@/lib/claims-store';

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

describe('document waivers — prior claims history', () => {
  it('buildClaimDocument records none-on-file waiver', () => {
    const parsed = parseClaimJson({
      ...validBase,
      priorClaimsHistoryNone: true,
    });
    const doc = buildClaimDocument(parsed, {});
    expect(doc.claimDetails.documentWaivers?.priorClaimsHistory?.reason).toBe(
      'none'
    );
  });

  it('does not waive when prior claims files are uploaded', () => {
    const parsed = parseClaimJson({
      ...validBase,
      priorClaimsHistoryNone: true,
      documents: {
        priorClaimsHistory:
          'https://abc.public.blob.vercel-storage.com/claims/prior.pdf',
      },
    });
    const doc = buildClaimDocument(parsed, {
      priorClaimsHistory:
        'https://abc.public.blob.vercel-storage.com/claims/prior.pdf',
    });
    expect(doc.claimDetails.documentWaivers).toBeUndefined();
  });

  it('treats waived prior claims as satisfied / not missing', () => {
    const waiver = buildDocumentWaiver('none');
    expect(
      isDocumentSlotSatisfied('priorClaimsHistory', {}, {
        priorClaimsHistory: waiver,
      })
    ).toBe(true);
    expect(isDocumentWaived({ priorClaimsHistory: waiver }, 'priorClaimsHistory')).toBe(
      true
    );

    const claim = {
      claimDetails: {
        documents: [],
        attachedDocuments: {},
        documentWaivers: { priorClaimsHistory: waiver },
        description: 'x',
        amount: 1,
      },
    } as unknown as ClaimRecord;

    expect(
      getMissingDocuments(claim).some((d) => d.field === 'priorClaimsHistory')
    ).toBe(false);
    expect(getWaivedDocuments(claim).map((d) => d.field)).toContain(
      'priorClaimsHistory'
    );
  });
});
