'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CONTRACT_TYPES } from '@/lib/contracts/types';
import {
  filterClaims,
  portalStats,
  sortClaims,
  type ClaimFilter,
  type ContractFilter,
  type PortalClaim,
} from '@/lib/claim-portal';
import { ClaimCard } from './ClaimCard';

export function ClaimsDashboard() {
  const [claims, setClaims] = useState<PortalClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ClaimFilter>('action_needed');
  const [contractFilter, setContractFilter] = useState<ContractFilter>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'newest' | 'risk' | 'amount'>(
    'priority'
  );
  const [search, setSearch] = useState('');

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

  const stats = useMemo(() => portalStats(claims), [claims]);

  const queueInsight = useMemo(() => {
    if (stats.actionQueue === 0) {
      return 'Queue clear — no claims need immediate adjuster action.';
    }
    const parts = [`${stats.actionQueue} claim${stats.actionQueue === 1 ? '' : 's'} need action`];
    if (stats.noAi > 0) parts.push(`${stats.noAi} without AI scan`);
    if (stats.needsInfo > 0) parts.push(`${stats.needsInfo} awaiting information`);
    if (stats.guidelineFlags > 0) parts.push(`${stats.guidelineFlags} with guideline flags`);
    return `${parts.join(' · ')}. Work highest-priority items first.`;
  }, [stats]);

  const visibleClaims = useMemo(() => {
    const query = search.trim().toLowerCase();
    let filtered = filterClaims(claims, statusFilter, contractFilter);

    if (query) {
      filtered = filtered.filter((claim) => {
        const haystack = [
          claim.claimantInformation.name,
          claim.policyInformation.policyNumber,
          claim.vehicleInfo.vin,
          claim.vehicleInfo.make,
          claim.vehicleInfo.model,
          claim.repairInformation.detailedRepairDescription,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      });
    }

    return sortClaims(filtered, sortBy);
  }, [claims, statusFilter, contractFilter, sortBy, search]);

  if (loading) {
    return <p className="loading">Loading underwriting workbench…</p>;
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
    <div className="adjuster-portal">
      <p className="portal-queue-insight">{queueInsight}</p>

      <section className="portal-stats-grid">
        <StatCard
          label="Action queue"
          value={stats.actionQueue}
          tone="pending"
          active={statusFilter === 'action_needed'}
          onClick={() => setStatusFilter('action_needed')}
        />
        <StatCard
          label="Needs info"
          value={stats.needsInfo}
          tone="pending"
          active={statusFilter === 'needs_info'}
          onClick={() => setStatusFilter('needs_info')}
        />
        <StatCard
          label="Guideline flags"
          value={stats.guidelineFlags}
          tone="pending"
          active={statusFilter === 'guideline_flags'}
          onClick={() => setStatusFilter('guideline_flags')}
        />
        <StatCard
          label="High risk"
          value={stats.highRisk}
          tone="denied"
          active={statusFilter === 'high_risk'}
          onClick={() => setStatusFilter('high_risk')}
        />
        <StatCard
          label="No AI scan"
          value={stats.noAi}
          active={statusFilter === 'no_ai'}
          onClick={() => setStatusFilter('no_ai')}
        />
        <StatCard
          label="Under review"
          value={stats.underReview}
          active={statusFilter === 'under_review'}
          onClick={() => setStatusFilter('under_review')}
        />
        <StatCard label="Approved" value={stats.approved} tone="approved" />
        <StatCard label="Denied" value={stats.denied} tone="denied" />
      </section>

      <section className="portal-toolbar">
        <div className="portal-filter-group">
          <label className="portal-filter-label" htmlFor="claim-search">
            Search
          </label>
          <input
            id="claim-search"
            className="portal-search"
            placeholder="Name, policy, VIN, repair…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="portal-filter-group">
          <label className="portal-filter-label" htmlFor="status-filter">
            Queue
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ClaimFilter)}
          >
            <option value="action_needed">Action needed</option>
            <option value="all">All claims</option>
            <option value="needs_info">Needs information</option>
            <option value="guideline_flags">Guideline flags</option>
            <option value="high_risk">High risk (7+)</option>
            <option value="under_review">Under review</option>
            <option value="no_ai">No AI scan</option>
          </select>
        </div>

        <div className="portal-filter-group">
          <label className="portal-filter-label" htmlFor="contract-filter">
            Contract
          </label>
          <select
            id="contract-filter"
            value={contractFilter}
            onChange={(e) => setContractFilter(e.target.value as ContractFilter)}
          >
            <option value="all">All types</option>
            {CONTRACT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
            <option value="unknown">unknown</option>
          </select>
        </div>

        <div className="portal-filter-group">
          <label className="portal-filter-label" htmlFor="sort-by">
            Sort
          </label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as 'priority' | 'newest' | 'risk' | 'amount')
            }
          >
            <option value="priority">Priority</option>
            <option value="risk">Highest risk</option>
            <option value="newest">Newest</option>
            <option value="amount">Highest amount</option>
          </select>
        </div>

        <button type="button" className="button button-secondary button-sm" onClick={loadClaims}>
          Refresh
        </button>
      </section>

      <p className="portal-results-meta">
        Showing <strong>{visibleClaims.length}</strong> of {claims.length} claims
      </p>

      {claims.length === 0 ? (
        <p className="empty-state">
          No claims yet. <Link href="/submit">Submit the first claim</Link>.
        </p>
      ) : visibleClaims.length === 0 ? (
        <p className="empty-state">
          No claims match this filter.{' '}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setStatusFilter('all');
              setContractFilter('all');
              setSearch('');
            }}
          >
            Clear filters
          </button>
        </p>
      ) : (
        <div className="claims-list">
          {visibleClaims.map((claim, index) => (
            <ClaimCard
              key={claim._id}
              claim={claim}
              onRefresh={loadClaims}
              defaultExpanded={index === 0 && statusFilter === 'action_needed'}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone?: 'pending' | 'approved' | 'denied';
  active?: boolean;
  onClick?: () => void;
}) {
  const className = [
    'stat-card',
    'portal-stat-card',
    tone ? `stat-${tone}` : '',
    onClick ? 'portal-stat-clickable' : '',
    active ? 'portal-stat-active' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
      </button>
    );
  }

  return (
    <div className={className}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}