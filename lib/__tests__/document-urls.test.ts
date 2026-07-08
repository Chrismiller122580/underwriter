import { describe, expect, it } from 'vitest';
import {
  buildDocumentProxyUrl,
  isAllowedClaimDocumentUrl,
  sanitizeClaimForPortal,
} from '@/lib/document-urls';
import type { ClaimRecord } from '@/lib/claims-store';

describe('isAllowedClaimDocumentUrl', () => {
  it('allows vercel blob claim uploads', () => {
    expect(
      isAllowedClaimDocumentUrl(
        'https://example.public.blob.vercel-storage.com/claims/abc/proof.pdf'
      )
    ).toBe(true);
  });

  it('rejects arbitrary external URLs', () => {
    expect(isAllowedClaimDocumentUrl('https://evil.example.com/claims/file.pdf')).toBe(
      false
    );
  });

  it('allows local upload paths scoped to a claim folder', () => {
    expect(
      isAllowedClaimDocumentUrl(
        'uploads/550e8400-e29b-41d4-a716-446655440000/proof.pdf'
      )
    ).toBe(true);
  });
});

describe('sanitizeClaimForPortal', () => {
  it('replaces stored document URLs with authenticated proxy paths', () => {
    const claim = {
      _id: '550e8400-e29b-41d4-a716-446655440000',
      claimDetails: {
        documents: ['https://example.public.blob.vercel-storage.com/claims/x.pdf'],
        attachedDocuments: {
          proofOfOwnership:
            'https://example.public.blob.vercel-storage.com/claims/x.pdf',
        },
      },
    } as ClaimRecord;

    const sanitized = sanitizeClaimForPortal(claim);
    expect(sanitized.claimDetails.attachedDocuments?.proofOfOwnership).toBe(
      buildDocumentProxyUrl(claim._id, 'proofOfOwnership')
    );
  });
});