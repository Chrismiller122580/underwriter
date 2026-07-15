import { describe, expect, it } from 'vitest';
import { evaluateComponentCoverage } from '@/lib/contracts/components';

describe('evaluateComponentCoverage', () => {
  it('marks alternator as covered on Vital', () => {
    const result = evaluateComponentCoverage(
      'vital',
      'Alternator replacement due to charging failure'
    );
    expect(result.status).toBe('covered');
    expect(result.hardDeny).toBe(false);
  });

  it('denies brake pads on stated Classic plan', () => {
    const result = evaluateComponentCoverage(
      'classic',
      'Front brake pads and rotors replacement'
    );
    expect(result.status).toBe('not_covered');
    expect(result.hardDeny).toBe(true);
  });

  it('denies tire work on Complete exclusionary plan', () => {
    const result = evaluateComponentCoverage(
      'complete',
      'Four new tires and wheel balance'
    );
    expect(result.status).toBe('excluded');
    expect(result.hardDeny).toBe(true);
  });

  it('treats engine internal repair as covered on Classic', () => {
    const result = evaluateComponentCoverage(
      'classic',
      'Cylinder head gasket and piston repair'
    );
    expect(result.status).toBe('covered');
    expect(result.hardDeny).toBe(false);
  });

  it('returns unclear for unknown free-text on stated plans', () => {
    const result = evaluateComponentCoverage(
      'classic',
      'Strange intermittent rattle noise diagnosis'
    );
    expect(result.status).toBe('unclear');
    expect(result.hardDeny).toBe(false);
  });

  it('allows non-excluded repair on Complete', () => {
    const result = evaluateComponentCoverage(
      'complete',
      'Transmission valve body replacement'
    );
    expect(result.status).toBe('covered');
    expect(result.hardDeny).toBe(false);
  });
});
