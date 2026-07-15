import { describe, expect, it } from 'vitest';
import { buildInfoRequest, normalizeInfoRequestItems } from '@/lib/info-request';

describe('normalizeInfoRequestItems', () => {
  it('trims, dedupes, and caps length', () => {
    const items = normalizeInfoRequestItems([
      '  Maintenance records  ',
      'maintenance records',
      '',
      'Oil change receipts',
    ]);
    expect(items).toEqual(['Maintenance records', 'Oil change receipts']);
  });
});

describe('buildInfoRequest', () => {
  it('builds a valid record', () => {
    const req = buildInfoRequest({
      items: ['Service history'],
      note: 'Please send ASAP',
      requestedBy: 'adjuster@fwcut.local',
      source: 'manual',
    });
    expect(req.items).toEqual(['Service history']);
    expect(req.note).toBe('Please send ASAP');
    expect(req.requestedBy).toBe('adjuster@fwcut.local');
    expect(req.source).toBe('manual');
    expect(req.requestedAt).toBeTruthy();
  });

  it('throws when no items remain', () => {
    expect(() => buildInfoRequest({ items: ['  ', ''] })).toThrow(/At least one/);
  });
});
