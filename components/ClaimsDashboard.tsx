'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CONTRACT_TYPES } from '@/lib/contracts/types';
import type { ClaimPortalStats } from '@/lib/claims-store';
import {
  filterClaims,
  sortClaims,
  type ClaimFilter,
  type ContractFilter,
  type PortalClaim,
} from '@/lib/claim-portal';
import { ClaimCard, type ClaimPatch } from './ClaimCard';
import {
  OnboardingTutorial,
  useOnboardingTutorial,
} from './OnboardingTutorial';

const QUEUE_FILTERS: { id: ClaimFilter; label: string; tone?: 'pending' | 'denied' }[] = [
  { id: 'action_needed', label: 'Action needed', tone: 'pending' },
  { id: 'needs_info', label: 'Needs info', tone: 'pending' },
  { id: 'guideline_flags', label: 'Guideline flags', tone: 'pending' },
  { id: 'high_risk', label: 'High risk', tone: 'denied' },
  { id: 'no_ai', label: 'No AI scan' },
  { id: 'under_review', label: 'Under review' },
];

type ClaimsPage = {
  claims: PortalClaim[];
  nextCursor: string | null;
};

export function ClaimsDashboard() {
  const tutorial = useOnboardingTutorial();
  const [claims, setClaims] = useState<PortalClaim[]>([]);
  const [stats, setStats] = useState<ClaimPortalStats | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ClaimFilter>('action_needed');
  const [contractFilter, setContractFilter] = useState<ContractFilter>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'newest' | 'risk' | 'amount'>(
    'priority'
  );
  const [search, setSearch] = useState('');

  const loadClaims = useCallback(async (cursor?: string) => {
    setError(null);
    const loadingMorePage = Boolean(cursor);

    try {
      const url = cursor
        ? `/api/claims?cursor=${encodeURIComponent(cursor)}`
        : '/api/claims';
      const response = await fetch(url);
      if (response.status === 401) {
        window.location.href = '/login?next=/claims';
        return;
      }
      if (!response.ok) throw new Error('Failed to load claims');

      const data = (await response.json()) as ClaimsPage;
      setClaims((current) =>
        cursor ? [...current, ...data.claims] : data.claims
      );
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load claims');
    } finally {
      if (loadingMorePage) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/claims/stats');
      if (response.status === 401) {
        window.location.href = '/login?next=/claims';
        return;
      }
      if (!response.ok) throw new Error('Failed to load claim stats');
      setStats((await response.json()) as ClaimPortalStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load claim stats');
      setLoading(false);
    }
  }, []);

  const refreshWorkbench = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadStats(), loadClaims()]);
  }, [loadClaims, loadStats]);

  const patchClaim = useCallback(
    (patch: ClaimPatch) => {
      setClaims((current) =>
        current.map((claim) =>
          claim._id === patch._id ? { ...claim, ...patch } : claim
        )
      );
      void loadStats();
    },
    [loadStats]
  );

  useEffect(() => {
    void refreshWorkbench();
  }, [refreshWorkbench]);

  const queueStats = useMemo(
    () =>
      stats ?? {
        total: claims.length,
        pending: 0,
        underReview: 0,
        approved: 0,
        denied: 0,
        needsInfo: 0,
        guidelineFlags: 0,
        noAi: 0,
        highRisk: 0,
        actionQueue: 0,
      },
    [stats, claims.length]
  );

  const queueInsight = useMemo(() => {
    if (queueStats.actionQueue === 0) {
      return 'Queue clear — no claims need immediate adjuster action.';
    }
    const parts = [
      `${queueStats.actionQueue} claim${queueStats.actionQueue === 1 ? '' : 's'} need action`,
    ];
    if (queueStats.noAi > 0) parts.push(`${queueStats.noAi} without AI scan`);
    if (queueStats.needsInfo > 0) {
      parts.push(`${queueStats.needsInfo} awaiting information`);
    }
    if (queueStats.guidelineFlags > 0) {
      parts.push(`${queueStats.guidelineFlags} with guideline flags`);
    }
    return `${parts.join(' · ')}. Work highest-priority items first.`;
  }, [queueStats]);

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

  const hasActiveFilters =
    statusFilter !== 'all' || contractFilter !== 'all' || search.trim().length > 0;

  function clearFilters() {
    setStatusFilter('all');
    setContractFilter('all');
    setSearch('');
  }

  if (loading) {
    return (
      <div className="adjuster-loading">
        <p className="loading">Loading underwriting workbench…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="adjuster-loading">
        <div className="form-error">
          {error}{' '}
          <button type="button" className="link-button" onClick={refreshWorkbench}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <OnboardingTutorial
        open={tutorial.open}
        onOpenChange={tutorial.setTutorialOpen}
        userKey={tutorial.userKey}
      />
      <div className="adjuster-layout">
      <aside className="adjuster-sidebar">
        <section className="adjuster-sidebar-section">
          <h2 className="adjuster-sidebar-title">Queue focus</h2>
          <div className="adjuster-sidebar-stats">
            {QUEUE_FILTERS.map((filter) => (
              <StatCard
                key={filter.id}
                label={filter.label}
                value={statValueForFilter(filter.id, queueStats)}
                tone={filter.tone}
                active={statusFilter === filter.id}
                onClick={() => setStatusFilter(filter.id)}
              />
            ))}
          </div>
        </section>

        <section className="adjuster-sidebar-section">
          <h2 className="adjuster-sidebar-title">Outcomes</h2>
          <div className="adjuster-sidebar-stats adjuster-sidebar-stats-compact">
            <StatCard label="Total" value={queueStats.total} />
            <StatCard label="Approved" value={queueStats.approved} tone="approved" />
            <StatCard label="Denied" value={queueStats.denied} tone="denied" />
          </div>
        </section>

        <section className="adjuster-sidebar-tip">
          <h2 className="adjuster-sidebar-title">Workflow</h2>
          <ol>
            <li>Run <strong>AI Scan</strong> on unscanned claims</li>
            <li>Review contract rules, docs, and AI flags</li>
            <li>Request missing info if needed</li>
            <li>Run <strong>AI Underwrite</strong> for final decision</li>
          </ol>
        </section>
      </aside>

      <div className="adjuster-main">
        <div className="portal-queue-insight">{queueInsight}</div>

        <section className="portal-toolbar">
          <div className="portal-filter-group portal-filter-search">
            <label className="portal-filter-label" htmlFor="claim-search">
              Search claims
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

          <button
            type="button"
            className="button button-secondary button-sm portal-refresh"
            onClick={refreshWorkbench}
          >
            Refresh
          </button>
        </section>

        {hasActiveFilters && (
          <div className="portal-active-filters">
            {statusFilter !== 'all' && (
              <FilterChip
                label={QUEUE_FILTERS.find((f) => f.id === statusFilter)?.label ?? statusFilter}
                onRemove={() => setStatusFilter('all')}
              />
            )}
            {contractFilter !== 'all' && (
              <FilterChip
                label={`Contract: ${contractFilter}`}
                onRemove={() => setContractFilter('all')}
              />
            )}
            {search.trim() && (
              <FilterChip label={`Search: ${search}`} onRemove={() => setSearch('')} />
            )}
            <button type="button" className="link-button" onClick={clearFilters}>
              Clear all
            </button>
          </div>
        )}

        <div className="portal-results-bar">
          <p className="portal-results-meta">
            Showing <strong>{visibleClaims.length}</strong> loaded
            {queueStats.total > claims.length
              ? ` of ${queueStats.total} total claims`
              : ` of ${claims.length} claims`}
          </p>
          <button
            type="button"
            className={`portal-view-all${statusFilter === 'all' ? ' active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            View all
          </button>
        </div>

        {queueStats.total === 0 ? (
          <p className="empty-state">
            No claims yet. <Link href="/submit">Submit the first claim</Link>.
          </p>
        ) : visibleClaims.length === 0 ? (
          <p className="empty-state">
            No claims match this filter.{' '}
            <button type="button" className="link-button" onClick={clearFilters}>
              Clear filters
            </button>
          </p>
        ) : (
          <div className="claims-list adjuster-claims-list">
            {visibleClaims.map((claim, index) => (
              <ClaimCard
                key={claim._id}
                claim={claim}
                onClaimUpdated={patchClaim}
                defaultExpanded={index === 0 && statusFilter === 'action_needed'}
              />
            ))}
          </div>
        )}

        {nextCursor && (
          <div className="portal-load-more">
            <button
              type="button"
              className="button button-secondary"
              disabled={loadingMore}
              onClick={() => {
                setLoadingMore(true);
                void loadClaims(nextCursor);
              }}
            >
              {loadingMore ? 'Loading more claims…' : 'Load more claims'}
            </button>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

function statValueForFilter(filter: ClaimFilter, stats: ClaimPortalStats): number {
  switch (filter) {
    case 'action_needed':
      return stats.actionQueue;
    case 'needs_info':
      return stats.needsInfo;
    case 'guideline_flags':
      return stats.guidelineFlags;
    case 'high_risk':
      return stats.highRisk;
    case 'no_ai':
      return stats.noAi;
    case 'under_review':
      return stats.underReview;
    default:
      return stats.total;
  }
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

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="portal-filter-chip">
      {label}
      <button type="button" className="portal-filter-chip-remove" onClick={onRemove}>
        ×
      </button>
    </span>
  );
}