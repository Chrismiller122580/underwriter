import { describe, expect, it } from 'vitest';
import { fillPath } from '@/lib/fwis/config';
import { mapFwisClaimPayload, mapFwisPolicyPayload } from '@/lib/fwis/mappers';
import { fwisRecordsToFormImport } from '@/lib/fwis/to-form';

describe('fillPath', () => {
  it('encodes placeholders', () => {
    expect(
      fillPath('/api/v1/policies/{policyNumber}', { policyNumber: 'FWVL 123' })
    ).toBe('/api/v1/policies/FWVL%20123');
  });
});

describe('mapFwisPolicyPayload', () => {
  it('maps common snake_case and nested vehicle fields', () => {
    const mapped = mapFwisPolicyPayload(
      {
        policy_number: 'FWVL041518',
        effective_date: '2024-01-01',
        expiration_date: '2028-01-01',
        vehicle: { vin: '1HGCM82633A004352', make: 'Honda', year: 2020 },
      },
      'FALLBACK'
    );

    expect(mapped.policyNumber).toBe('FWVL041518');
    expect(mapped.effectiveDate).toBe('2024-01-01');
    expect(mapped.vin).toBe('1HGCM82633A004352');
    expect(mapped.make).toBe('Honda');
    expect(mapped.year).toBe(2020);
  });

  it('unwraps { data: ... } envelopes', () => {
    const mapped = mapFwisPolicyPayload(
      { data: { ContractNumber: 'FWCL9', PlanName: 'Classic' } },
      'X'
    );
    expect(mapped.policyNumber).toBe('FWCL9');
    expect(mapped.coverageDetails).toBe('Classic');
  });
});

describe('mapFwisClaimPayload', () => {
  it('maps claim aliases', () => {
    const mapped = mapFwisClaimPayload(
      {
        ClaimId: 'C-99',
        customerName: 'Pat Lee',
        estimate: 2200,
        lossDate: '2025-05-01',
      },
      'fallback'
    );
    expect(mapped.fwisClaimId).toBe('C-99');
    expect(mapped.claimantName).toBe('Pat Lee');
    expect(mapped.repairEstimate).toBe(2200);
    expect(mapped.dateOfLoss).toBe('2025-05-01');
  });
});

describe('fwisRecordsToFormImport', () => {
  it('merges policy + claim into form fields for intake', () => {
    const form = fwisRecordsToFormImport(
      'FWVL041518',
      'CLM-100',
      {
        policyNumber: 'FWVL041518',
        effectiveDate: '2024-01-01',
        expirationDate: '2028-01-01',
        coverageDetails: 'Freedom Vital',
        vin: '1HGCM82633A004352',
        make: 'Honda',
        model: 'Accord',
        year: 2020,
        odometerAtEffective: 40000,
      },
      {
        fwisClaimId: 'abc',
        claimNumber: 'CLM-100',
        claimantName: 'Jane Smith',
        contact: 'jane@example.com',
        odometer: 45000,
        dateOfLoss: '2025-06-01',
        description: 'Engine noise',
        location: 'Atlanta, GA',
        repairEstimate: 1500,
        repairDescription: 'Alternator replacement',
        shop: 'City Auto',
      }
    );

    expect(form.fields.policyNumber).toBe('FWVL041518');
    expect(form.fields.name).toBe('Jane Smith');
    expect(form.fields.repairEstimate).toBe('1500');
    expect(form.fields.odometerAtEffective).toBe('40000');
    expect(form.contractType).toBe('vital');
    expect(form.fwisClaimNumber).toBe('CLM-100');
    expect(form.fieldsFound.length).toBeGreaterThan(10);
  });
});
