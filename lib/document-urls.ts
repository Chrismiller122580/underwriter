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
  documents: Record<string, string>
): void {
  for (const [field, url] of Object.entries(documents)) {
    if (!isAllowedClaimDocumentUrl(url)) {
      throw new Error(
        `Document URL for "${field}" is not from an allowed upload source.`
      );
    }
  }
}

export function buildDocumentProxyUrl(claimId: string, field: string): string {
  return `/api/claims/${claimId}/documents/${field}`;
}

export function sanitizeClaimForPortal(claim: ClaimRecord): ClaimRecord {
  const attached = claim.claimDetails.attachedDocuments;
  if (!attached || Object.keys(attached).length === 0) {
    return claim;
  }

  const sanitizedAttached = Object.fromEntries(
    FILE_FIELDS.filter((field) => attached[field]).map((field) => [
      field,
      buildDocumentProxyUrl(claim._id, field),
    ])
  );

  return {
    ...claim,
    claimDetails: {
      ...claim.claimDetails,
      documents: Object.values(sanitizedAttached),
      attachedDocuments: sanitizedAttached,
    },
  };
}