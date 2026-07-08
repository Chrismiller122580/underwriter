'use client';

import { useState } from 'react';
import type { AiAnalysis } from '@/lib/ai-types';

export type AnalyzeResult = {
  aiAnalysis: AiAnalysis;
  reused: boolean;
};

export function AnalyzeButton({
  claimId,
  onComplete,
  label = 'Run AI Scan',
  force = false,
}: {
  claimId: string;
  onComplete?: (result: AnalyzeResult) => void;
  label?: string;
  force?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);

    try {
      const url = force
        ? `/api/claims/${claimId}/analyze?force=true`
        : `/api/claims/${claimId}/analyze`;
      const response = await fetch(url, {
        method: 'POST',
      });

      if (response.status === 401) {
        window.location.href = '/login?next=/claims';
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'AI analysis failed');
      }

      const data = (await response.json()) as {
        aiAnalysis: AiAnalysis;
        reused?: boolean;
      };
      onComplete?.({
        aiAnalysis: data.aiAnalysis,
        reused: Boolean(data.reused),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI analysis failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="button button-secondary button-sm"
        onClick={handleAnalyze}
        disabled={loading}
      >
        {loading ? 'Analyzing…' : label}
      </button>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}