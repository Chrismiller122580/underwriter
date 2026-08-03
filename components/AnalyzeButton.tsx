'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AiAnalysis } from '@/lib/ai-types';
import {
  apiFetch,
  isUnauthorized,
  loginPath,
} from '@/lib/client-api';

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
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);

    try {
      const url = force
        ? `/api/claims/${claimId}/analyze?force=true`
        : `/api/claims/${claimId}/analyze`;
      const data = await apiFetch<{
        aiAnalysis: AiAnalysis;
        reused?: boolean;
      }>(url, {
        method: 'POST',
      });
      onComplete?.({
        aiAnalysis: data.aiAnalysis,
        reused: Boolean(data.reused),
      });
    } catch (err) {
      if (isUnauthorized(err)) {
        router.push(loginPath('/claims'));
        return;
      }
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
