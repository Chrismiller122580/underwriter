import { describe, expect, it } from 'vitest';
import {
  compactDocumentValue,
  countAttachedDocuments,
  documentUrls,
  hasAttachedDocument,
  mergeDocumentValues,
} from '@/lib/claim-documents';

describe('claim-documents helpers', () => {
  it('normalizes string and array values', () => {
    expect(documentUrls('a')).toEqual(['a']);
    expect(documentUrls(['a', 'b'])).toEqual(['a', 'b']);
    expect(documentUrls(undefined)).toEqual([]);
    expect(hasAttachedDocument(['x'])).toBe(true);
    expect(hasAttachedDocument('')).toBe(false);
  });

  it('merges multi-file uploads without duplicates', () => {
    expect(mergeDocumentValues('a', 'b')).toEqual(['a', 'b']);
    expect(mergeDocumentValues(['a'], ['a', 'b'])).toEqual(['a', 'b']);
    expect(mergeDocumentValues(undefined, ['x', 'y'])).toEqual(['x', 'y']);
  });

  it('compacts single-file slots to a string', () => {
    expect(compactDocumentValue(['only'])).toBe('only');
    expect(compactDocumentValue(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('counts total attached files across slots', () => {
    expect(
      countAttachedDocuments({
        proofOfOwnership: 'a',
        maintenanceRecords: ['b', 'c'],
      })
    ).toBe(3);
  });
});
