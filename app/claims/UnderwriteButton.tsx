'use client';

import { useState } from 'react';
import type { AiAnalysis } from '@/lib/ai-types';
import type { ClaimRecord } from '@/lib/claims-store';

export type UnderwriteResult = {
  status: string;
  aiAnalysis: AiAnalysis;
  underwriting: NonNullable<ClaimRecord['underwriting']>;
  aiReused: boolean;
};

export function UnderwriteButton({
  claimId,
  onComplete,
}: {
  claimId: string;
  onComplete?: (result: UnderwriteResult) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUnderwrite() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/claims/${claimId}/underwrite`, {
        method: 'POST',
      });

      if (response.status === 401) {
        window.location.href = '/login?next=/claims';
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Underwriting failed');
      }

      const data = (await response.json()) as {
        status: string;
        aiAnalysis: AiAnalysis;
        underwriting?: ClaimRecord['underwriting'];
        reason: string;
        decision: string;
        aiReused?: boolean;
      };

      onComplete?.({
        status: data.status,
        aiAnalysis: data.aiAnalysis,
        underwriting: data.underwriting ?? {
          decision: data.decision,
          reason: data.reason,
          reviewedAt: new Date().toISOString(),
        },
        aiReused: Boolean(data.aiReused),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Underwriting failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="button button-sm"
        onClick={handleUnderwrite}
        disabled={loading}
      >
        {loading ? 'AI Underwriting…' : 'AI Underwrite'}
      </button>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}