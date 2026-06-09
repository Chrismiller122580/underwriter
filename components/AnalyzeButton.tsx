'use client';

import { useState } from 'react';

export function AnalyzeButton({
  claimId,
  onComplete,
  label = 'Run AI Scan',
}: {
  claimId: string;
  onComplete?: () => void;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/claims/${claimId}/analyze`, {
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

      onComplete?.();
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