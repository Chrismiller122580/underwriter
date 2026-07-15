'use client';

import { useState } from 'react';
import type { ClaimRecord } from '@/lib/claims-store';

export type ManualDecisionResult = {
  status: string;
  underwriting: NonNullable<ClaimRecord['underwriting']>;
  infoRequest?: ClaimRecord['infoRequest'] | null;
  updatedAt?: string;
};

const DECISIONS = [
  { id: 'approved' as const, label: 'Approve' },
  { id: 'denied' as const, label: 'Deny' },
  { id: 'under_review' as const, label: 'Send to review' },
];

export function ManualDecisionButton({
  claimId,
  currentStatus,
  onComplete,
}: {
  claimId: string;
  currentStatus: string;
  onComplete?: (result: ManualDecisionResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [decision, setDecision] =
    useState<(typeof DECISIONS)[number]['id']>('under_review');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/claims/${claimId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason: reason.trim() }),
      });

      if (response.status === 401) {
        window.location.href = '/login?next=/claims';
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Manual decision failed');
      }

      const data = (await response.json()) as {
        status: string;
        underwriting: NonNullable<ClaimRecord['underwriting']>;
        infoRequest?: ClaimRecord['infoRequest'] | null;
        updatedAt?: string;
      };

      onComplete?.({
        status: data.status,
        underwriting: data.underwriting,
        infoRequest: data.infoRequest,
        updatedAt: data.updatedAt,
      });
      setOpen(false);
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Manual decision failed');
    } finally {
      setLoading(false);
    }
  }

  const isOverride =
    currentStatus === 'approved' || currentStatus === 'denied';

  return (
    <div className="manual-decision-control">
      <button
        type="button"
        className="button button-sm button-secondary"
        onClick={() => {
          setOpen((v) => !v);
          setError(null);
        }}
      >
        {open
          ? 'Cancel'
          : isOverride
            ? 'Override decision'
            : 'Manual decision'}
      </button>

      {open && (
        <div className="manual-decision-panel">
          <p className="form-hint">
            Records a human decision with a required reason and writes an audit
            event. Use when AI/rules should not have the final word.
          </p>
          <div className="manual-decision-options">
            {DECISIONS.map((option) => (
              <label key={option.id}>
                <input
                  type="radio"
                  name={`decision-${claimId}`}
                  checked={decision === option.id}
                  onChange={() => setDecision(option.id)}
                />{' '}
                {option.label}
              </label>
            ))}
          </div>
          <label htmlFor={`manual-reason-${claimId}`}>Reason (required)</label>
          <textarea
            id={`manual-reason-${claimId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Explain why you are approving, denying, or sending to review…"
          />
          <button
            type="button"
            className="button button-sm"
            onClick={submit}
            disabled={loading || reason.trim().length < 10}
          >
            {loading ? 'Saving…' : 'Record decision'}
          </button>
          {reason.trim().length > 0 && reason.trim().length < 10 && (
            <p className="form-hint">Reason needs at least 10 characters.</p>
          )}
        </div>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
