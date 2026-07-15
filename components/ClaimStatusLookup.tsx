'use client';

import { FormEvent, useState } from 'react';
import type { PublicClaimStatus } from '@/lib/public-status';

export function ClaimStatusLookup() {
  const [trackingCode, setTrackingCode] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicClaimStatus | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/public/claim-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingCode: trackingCode.trim(),
          lastName: lastName.trim(),
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        claim?: PublicClaimStatus;
      };

      if (!response.ok) {
        throw new Error(data.error ?? 'Lookup failed');
      }

      setResult(data.claim ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="status-lookup">
      <form className="status-lookup-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="trackingCode">Tracking code</label>
          <input
            id="trackingCode"
            value={trackingCode}
            onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
            placeholder="e.g. AB12CD34EF"
            required
            minLength={6}
            maxLength={32}
            autoComplete="off"
          />
        </div>
        <div className="form-field">
          <label htmlFor="lastName">Claimant last name</label>
          <input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="As shown on the claim"
            required
            autoComplete="family-name"
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="button" disabled={loading}>
          {loading ? 'Looking up…' : 'Check status'}
        </button>
      </form>

      {result && (
        <div className={`status-result status-result-${result.status}`}>
          <p className="badge">{result.statusLabel}</p>
          <h2>Tracking {result.trackingCode}</h2>
          <dl className="status-result-facts">
            <div>
              <dt>Vehicle</dt>
              <dd>{result.vehicleSummary}</dd>
            </div>
            <div>
              <dt>Claim amount</dt>
              <dd>${result.amount.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Policy (last 4)</dt>
              <dd>{result.policyLast4 ?? '—'}</dd>
            </div>
            <div>
              <dt>Submitted</dt>
              <dd>{new Date(result.submittedAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{new Date(result.lastUpdatedAt).toLocaleString()}</dd>
            </div>
          </dl>
          {result.decisionSummary && (
            <p className="status-result-summary">{result.decisionSummary}</p>
          )}
          {result.infoRequests && result.infoRequests.length > 0 && (
            <div className="status-info-requests">
              <strong>Information requested</strong>
              <ul>
                {result.infoRequests.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="form-hint">
                Reply to your adjuster or repair facility with these items so
                review can continue.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
