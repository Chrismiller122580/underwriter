import { describe, expect, it } from 'vitest';
import {
  evaluateLaborRateRules,
  inferVehicleLaborClass,
  parseDiagnosticHoursFromText,
  parseLaborRateFromText,
} from '@/lib/labor-rate-rules';

describe('parseLaborRateFromText', () => {
  it('parses common labor rate phrases', () => {
    expect(parseLaborRateFromText('Labor rate $125/hr for repair')).toBe(125);
    expect(parseLaborRateFromText('shop charges $95 per hour')).toBe(95);
  });

  it('returns null when no rate present', () => {
    expect(parseLaborRateFromText('Alternator replacement only')).toBeNull();
  });
});

describe('parseDiagnosticHoursFromText', () => {
  it('parses diagnostic hours over the cap', () => {
    expect(parseDiagnosticHoursFromText('Diagnostic time 2.5 hours')).toBe(2.5);
  });
});

describe('inferVehicleLaborClass', () => {
  it('classifies luxury makes as E/X', () => {
    expect(inferVehicleLaborClass('BMW', 2018)).toBe('E/X');
  });

  it('classifies common makes as A-D', () => {
    expect(inferVehicleLaborClass('Honda', 2020)).toBe('A-D');
  });
});

describe('evaluateLaborRateRules', () => {
  it('holds for review when labor exceeds enhanced A-D cap', () => {
    const result = evaluateLaborRateRules({
      make: 'Honda',
      year: 2019,
      repairDescription: 'Alternator replacement, labor rate $140/hr',
    });
    expect(result.laborRate).toBe(140);
    expect(result.needsReview).toBe(true);
    expect(result.maxEnhanced).toBe(110);
  });

  it('holds when diagnostic hours exceed 1.5', () => {
    const result = evaluateLaborRateRules({
      make: 'Toyota',
      year: 2017,
      repairDescription: 'Engine noise, diagnostic time 3 hours',
    });
    expect(result.diagnosticHours).toBe(3);
    expect(result.needsReview).toBe(true);
  });

  it('allows rate within enhanced E/X caps', () => {
    const result = evaluateLaborRateRules({
      make: 'BMW',
      year: 2016,
      repairDescription: 'Cooling fan, labor @ $150/hr',
    });
    expect(result.laborRate).toBe(150);
    expect(result.vehicleClass).toBe('E/X');
    expect(result.needsReview).toBe(false);
  });
});
