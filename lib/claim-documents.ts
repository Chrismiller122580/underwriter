/**
 * Helpers for claim supporting-document slots.
 * Stored values may be a single URL string (legacy) or a string[] of URLs.
 */

export type AttachedDocumentValue = string | string[];
export type AttachedDocumentsMap = Record<string, AttachedDocumentValue>;

export function documentUrls(
  value: AttachedDocumentValue | undefined | null
): string[] {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) {
    return value.filter((url): url is string => typeof url === 'string' && url.length > 0);
  }
  return typeof value === 'string' && value.length > 0 ? [value] : [];
}

export function hasAttachedDocument(
  value: AttachedDocumentValue | undefined | null
): boolean {
  return documentUrls(value).length > 0;
}

/** Prefer a single string when only one URL; otherwise store an array. */
export function compactDocumentValue(urls: string[]): AttachedDocumentValue | undefined {
  const cleaned = urls.filter((url) => typeof url === 'string' && url.length > 0);
  if (cleaned.length === 0) return undefined;
  if (cleaned.length === 1) return cleaned[0];
  return cleaned;
}

/** Append incoming URLs to any existing slot value (deduped). */
export function mergeDocumentValues(
  existing: AttachedDocumentValue | undefined,
  incoming: AttachedDocumentValue
): AttachedDocumentValue {
  const prev = documentUrls(existing);
  const next = documentUrls(incoming);
  const seen = new Set(prev);
  const merged = [...prev];
  for (const url of next) {
    if (!seen.has(url)) {
      seen.add(url);
      merged.push(url);
    }
  }
  return compactDocumentValue(merged) ?? '';
}

export function flattenAttachedDocuments(
  attached: AttachedDocumentsMap | undefined | null
): string[] {
  if (!attached) return [];
  return Object.values(attached).flatMap((value) => documentUrls(value));
}

export function countAttachedDocuments(
  attached: AttachedDocumentsMap | undefined | null
): number {
  return flattenAttachedDocuments(attached).length;
}
