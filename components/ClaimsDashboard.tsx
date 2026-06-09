'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { UnderwriteButton } from '@/app/claims/UnderwriteButton';
import { getContractDisplayName } from '@/lib/contracts/registry';
import type { ContractTypeOrUnknown } from '@/lib/contracts/types';
import { AiInsights } from './AiInsights';
import { AnalyzeButton } from './AnalyzeButton';

type AiAnalysis = {
  summary: string;
  riskScore: number;
  recommendation: string;
  reasoning: string;
  flags: string[];
  fraudIndicators: string[];
  confidence: number;
  model: string;
  contractValid?: boolean | null;
  waitingPeriodMet?: boolean | null;
  componentCovered?: boolean | null;
  maintenanceConcern?: boolean | null;
  inspectionRecommended?: boolean | null;
  denialCategory?: string | null;
};

type Claim = {
  _id: string;
  status: string;
  createdAt: string;
  claimantInformation: { name: string };
  vehicleInfo: { year: number; make: string; model: string; vin: string };
  policyInformation: {
    policyNumber: string;
    contractType?: ContractTypeOrUnknown;
    contractVariant?: 'standard' | 'manufacturer_extension';
  };
  claimDetails: { amount: number; documents?: string[] };
  underwriting?: { reason?: string; decision?: string };
  aiAnalysis?: AiAnalysis;
};

function statusClass(status: string) {
  return `status-pill status-${status}`;
}

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function riskBadge(score: number) {
  if (score >= 8) return 'risk-high';
  if (score >= 5) return 'risk-medium';
  return 'risk-low';
}

export function ClaimsDashboard() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClaims = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch('/api/claims');
      if (response.status === 401) {
        window.location.href = '/login?next=/claims';
        return;
      }
      if (!response.ok) throw new Error('Failed to load claims');
      const data = await response.json();
      setClaims(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load claims');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  const stats = {
    total: claims.length,
    pending: claims.filter((c) => c.status === 'pending').length,
    approved: claims.filter((c) => c.status === 'approved').length,
    denied: claims.filter((c) => c.status === 'denied').length,
    highRisk: claims.filter((c) => (c.aiAnalysis?.riskScore ?? 0) >= 7).length,
  };

  if (loading) {
    return <p className="loading">Loading claims…</p>;
  }

  if (error) {
    return (
      <div className="form-error">
        {error}{' '}
        <button type="button" className="link-button" onClick={loadClaims}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="stats-grid">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Pending" value={stats.pending} tone="pending" />
        <StatCard label="Approved" value={stats.approved} tone="approved" />
        <StatCard label="Denied" value={stats.denied} tone="denied" />
        <StatCard label="High Risk" value={stats.highRisk} tone="denied" />
      </div>

      {claims.length === 0 ? (
        <p className="empty-state">
          No claims yet. <Link href="/submit">Submit the first claim</Link>.
        </p>
      ) : (
        <div className="claims-list">
          {claims.map((claim) => (
            <article key={claim._id} className="claim-card">
              <div className="claim-card-header">
                <div>
                  <h3>{claim.claimantInformation.name}</h3>
                  <p className="claim-meta">
                    {claim.vehicleInfo.year} {claim.vehicleInfo.make}{' '}
                    {claim.vehicleInfo.model} · VIN {claim.vehicleInfo.vin}
                  </p>
                </div>
                <div className="claim-badges">
                  {claim.aiAnalysis && (
                    <span
                      className={`risk-score ${riskBadge(claim.aiAnalysis.riskScore)}`}
                    >
                      AI Risk {claim.aiAnalysis.riskScore}/10
                    </span>
                  )}
                  <span className={statusClass(claim.status)}>
                    {claim.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <dl className="claim-details">
                <div>
                  <dt>Policy</dt>
                  <dd>
                    {claim.policyInformation.policyNumber}
                    {claim.policyInformation.contractType &&
                      claim.policyInformation.contractType !== 'unknown' && (
                        <span
                          className={`contract-type-badge contract-type-${claim.policyInformation.contractType}`}
                        >
                          {getContractDisplayName(
                            claim.policyInformation.contractType,
                            claim.policyInformation.contractVariant
                          )}
                        </span>
                      )}
                  </dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd>${claim.claimDetails.amount.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Submitted</dt>
                  <dd>{formatDate(claim.createdAt)}</dd>
                </div>
                <div>
                  <dt>Documents</dt>
                  <dd>{claim.claimDetails.documents?.length ?? 0} files</dd>
                </div>
              </dl>

              {claim.aiAnalysis && <AiInsights analysis={claim.aiAnalysis} />}

              {claim.underwriting?.reason && !claim.aiAnalysis && (
                <p className="underwriting-note">{claim.underwriting.reason}</p>
              )}

              <div className="claim-card-actions">
                {claim.status === 'pending' ? (
                  <div className="action-row">
                    {!claim.aiAnalysis && (
                      <AnalyzeButton
                        claimId={claim._id}
                        onComplete={loadClaims}
                      />
                    )}
                    <UnderwriteButton
                      claimId={claim._id}
                      onComplete={loadClaims}
                    />
                  </div>
                ) : (
                  <span className="done-label">Underwriting complete</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'pending' | 'approved' | 'denied';
}) {
  return (
    <div className={`stat-card${tone ? ` stat-${tone}` : ''}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}