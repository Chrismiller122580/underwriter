'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function UnderwriteButton({
  claimId,
  onComplete,
}: {
  claimId: string;
  onComplete?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUnderwrite() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/claims/${claimId}/underwrite`, {
        method: 'POST',
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Underwriting failed');
      }

      onComplete?.();
      router.refresh();
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
        {loading ? 'Running…' : 'Underwrite'}
      </button>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}