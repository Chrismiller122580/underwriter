import {
  documentUrls,
  hasAttachedDocument,
  type AttachedDocumentValue,
  type AttachedDocumentsMap,
} from '@/lib/claim-documents';
import type { ClaimRecord } from '@/lib/claims-store';
import { FILE_FIELDS } from '@/lib/parse-claim-form';

const ALLOWED_BLOB_HOST_SUFFIXES = [
  '.public.blob.vercel-storage.com',
  '.blob.vercel-storage.com',
] as const;

export function isAllowedClaimDocumentUrl(url: string): boolean {
  if (url.startsWith('uploads/')) {
    return /^uploads\/[0-9a-f-]{36}\//i.test(url);
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;

    const hostAllowed = ALLOWED_BLOB_HOST_SUFFIXES.some((suffix) =>
      parsed.hostname.endsWith(suffix)
    );
    if (!hostAllowed) return false;

    return parsed.pathname.includes('/claims/');
  } catch {
    return false;
  }
}

export function validateClaimDocumentUrls(
  documents: Record<string, string | string[]>
): void {
  for (const [field, value] of Object.entries(documents)) {
    for (const url of documentUrls(value)) {
      if (!isAllowedClaimDocumentUrl(url)) {
        throw new Error(
          `Document URL for "${field}" is not from an allowed upload source.`
        );
      }
    }
  }
}

export function buildDocumentProxyUrl(
  claimId: string,
  field: string,
  index = 0
): string {
  const base = `/api/claims/${claimId}/documents/${field}`;
  return index > 0 ? `${base}?index=${index}` : base;
}

function sanitizeAttachedValue(
  claimId: string,
  field: string,
  value: AttachedDocumentValue
): AttachedDocumentValue | undefined {
  const urls = documentUrls(value);
  if (urls.length === 0) return undefined;
  if (urls.length === 1) return buildDocumentProxyUrl(claimId, field, 0);
  return urls.map((_, index) => buildDocumentProxyUrl(claimId, field, index));
}

export function sanitizeClaimForPortal(claim: ClaimRecord): ClaimRecord {
  const attached = claim.claimDetails.attachedDocuments as
    | AttachedDocumentsMap
    | undefined;
  if (!attached || Object.keys(attached).length === 0) {
    return claim;
  }

  const sanitizedAttached: AttachedDocumentsMap = {};
  for (const field of FILE_FIELDS) {
    if (!hasAttachedDocument(attached[field])) continue;
    const sanitized = sanitizeAttachedValue(claim._id, field, attached[field]);
    if (sanitized !== undefined) {
      sanitizedAttached[field] = sanitized;
    }
  }

  const flat = Object.values(sanitizedAttached).flatMap((value) =>
    documentUrls(value)
  );

  return {
    ...claim,
    claimDetails: {
      ...claim.claimDetails,
      documents: flat,
      attachedDocuments: sanitizedAttached,
    },
  };
}
