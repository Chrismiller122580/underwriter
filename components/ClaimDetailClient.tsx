'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  apiFetch,
  isUnauthorized,
  loginPath,
} from '@/lib/client-api';
import type { PortalClaim } from '@/lib/claim-portal';
import { ClaimCard, type ClaimPatch } from './ClaimCard';

export function ClaimDetailClient({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [claim, setClaim] = useState<PortalClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClaim = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ claim: PortalClaim }>(
        `/api/claims/${claimId}`
      );
      setClaim(data.claim);
    } catch (err) {
      if (isUnauthorized(err)) {
        router.push(loginPath(`/claims/${claimId}`));
        return;
      }
      const message =
        err instanceof Error ? err.message : 'Failed to load claim';
      setError(
        message.toLowerCase().includes('not found')
          ? 'Claim not found.'
          : message
      );
      setClaim(null);
    } finally {
      setLoading(false);
    }
  }, [claimId, router]);

  useEffect(() => {
    void loadClaim();
  }, [loadClaim]);

  const patchClaim = useCallback((patch: ClaimPatch) => {
    setClaim((current) => {
      if (!current || current._id !== patch._id) return current;
      return {
        ...current,
        ...patch,
        infoRequest:
          patch.infoRequest === null
            ? undefined
            : (patch.infoRequest ?? current.infoRequest),
      };
    });
  }, []);

  if (loading) {
    return (
      <div className="adjuster-loading">
        <p className="loading">Loading claim…</p>
      </div>
    );
  }

  if (error || !claim) {
    return (
      <div className="claim-detail-error card">
        <p className="form-error">{error ?? 'Claim not found.'}</p>
        <div className="claim-detail-error-actions">
          <Link href="/claims" className="button button-secondary">
            Back to queue
          </Link>
          <button
            type="button"
            className="button"
            onClick={() => void loadClaim()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="claim-detail-layout">
      <div className="claim-detail-toolbar">
        <Link href="/claims" className="claim-back-link">
          ← Back to queue
        </Link>
        <div className="claim-detail-toolbar-meta">
          {claim.publicToken && (
            <span className="claim-detail-tracking">
              Tracking <strong>{claim.publicToken}</strong>
            </span>
          )}
          <button
            type="button"
            className="button button-secondary button-sm"
            onClick={() => void loadClaim()}
          >
            Refresh
          </button>
        </div>
      </div>

      <ClaimCard
        claim={claim}
        onClaimUpdated={patchClaim}
        variant="detail"
        defaultExpanded
      />
    </div>
  );
}
