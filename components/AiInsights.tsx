'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { AiAnalysis } from '@/lib/ai-types';
import {
  apiFetch,
  isUnauthorized,
  loginPath,
} from '@/lib/client-api';
import type { GuidelineSkip } from '@/lib/guideline-skips';
import {
  getActiveGuidelineConflicts,
  getSkippedGuidelineConflicts,
  isMaintenanceGuidelineConflict,
} from '@/lib/guideline-skips';

function riskClass(score: number) {
  if (score >= 8) return 'risk-high';
  if (score >= 5) return 'risk-medium';
  return 'risk-low';
}

function formatCheck(value: boolean | null | undefined, label: string) {
  if (value === null || value === undefined) return null;
  return `${label}: ${value ? 'Yes' : 'No'}`;
}

export type AiInsightsProps = {
  analysis: AiAnalysis;
  claimId?: string;
  guidelineSkips?: GuidelineSkip[];
  onGuidelineSkipped?: (skips: GuidelineSkip[]) => void;
  /** When false, hide skip controls (read-only surfaces). */
  allowSkip?: boolean;
};

export function AiInsights({
  analysis,
  claimId,
  guidelineSkips = [],
  onGuidelineSkipped,
  allowSkip = true,
}: AiInsightsProps) {
  const router = useRouter();
  const [skipping, setSkipping] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteByConflict, setNoteByConflict] = useState<Record<string, string>>(
    {}
  );

  const openConflicts = useMemo(
    () => getActiveGuidelineConflicts(analysis.guidelineConflicts, guidelineSkips),
    [analysis.guidelineConflicts, guidelineSkips]
  );
  const skippedConflicts = useMemo(
    () =>
      getSkippedGuidelineConflicts(analysis.guidelineConflicts, guidelineSkips),
    [analysis.guidelineConflicts, guidelineSkips]
  );

  const checks = [
    formatCheck(analysis.contractValid, 'Contract valid'),
    formatCheck(analysis.waitingPeriodMet, 'Waiting period met'),
    formatCheck(analysis.componentCovered, 'Component covered'),
    formatCheck(analysis.maintenanceConcern, 'Maintenance concern'),
    formatCheck(analysis.inspectionRecommended, 'Inspection recommended'),
  ].filter(Boolean);

  async function skipConflict(conflict: string) {
    if (!claimId) return;
    setError(null);
    setSkipping(conflict);
    try {
      const data = await apiFetch<{
        guidelineSkips: GuidelineSkip[];
        message?: string;
      }>(`/api/claims/${claimId}/skip-guideline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conflict,
          note: noteByConflict[conflict]?.trim() || undefined,
        }),
      });
      onGuidelineSkipped?.(data.guidelineSkips ?? []);
    } catch (err) {
      if (isUnauthorized(err)) {
        router.push(loginPath('/claims'));
        return;
      }
      setError(
        err instanceof Error ? err.message : 'Failed to skip guideline concern'
      );
    } finally {
      setSkipping(null);
    }
  }

  const canSkip = allowSkip && Boolean(claimId);

  return (
    <div className="ai-insights">
      <div className="ai-header">
        <span className="ai-badge">AI Analysis</span>
        <span className={`risk-score ${riskClass(analysis.riskScore)}`}>
          Risk {analysis.riskScore}/10
        </span>
        <span className="ai-confidence">{analysis.confidence}% confidence</span>
      </div>

      <p className="ai-summary">{analysis.summary}</p>
      <p className="ai-reasoning">{analysis.reasoning}</p>

      <p className="ai-recommendation">
        Recommendation:{' '}
        <strong>{analysis.recommendation.toUpperCase()}</strong>
        {analysis.denialCategory && (
          <span className="ai-denial-category">
            {' '}
            ({analysis.denialCategory.replace('_', ' ')})
          </span>
        )}
      </p>

      {checks.length > 0 && (
        <div className="ai-checks">
          {checks.map((check) => (
            <span key={check} className="ai-check-item">
              {check}
            </span>
          ))}
        </div>
      )}

      {(analysis.informationRequests?.length ?? 0) > 0 && (
        <div className="ai-info-requests">
          <strong>Information needed</strong>
          <ul>
            {analysis.informationRequests!.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {openConflicts.length > 0 && (
        <div className="ai-guideline-conflicts">
          <strong>Guideline concerns</strong>
          <p className="form-hint ai-guideline-hint">
            Review each concern. Skip only when you accept the risk or have
            verified the issue offline (e.g. maintenance confirmed by shop).
          </p>
          <ul className="ai-guideline-list">
            {openConflicts.map((item) => (
              <li key={item} className="ai-guideline-item">
                <span className="ai-guideline-text">{item}</span>
                {canSkip && (
                  <div className="ai-guideline-actions">
                    <input
                      type="text"
                      className="ai-guideline-note"
                      placeholder={
                        isMaintenanceGuidelineConflict(item)
                          ? 'Optional note (e.g. shop confirmed oil changes)'
                          : 'Optional note for audit trail'
                      }
                      value={noteByConflict[item] ?? ''}
                      onChange={(e) =>
                        setNoteByConflict((prev) => ({
                          ...prev,
                          [item]: e.target.value,
                        }))
                      }
                      maxLength={500}
                      disabled={skipping === item}
                    />
                    <button
                      type="button"
                      className="button button-sm button-secondary"
                      onClick={() => void skipConflict(item)}
                      disabled={Boolean(skipping)}
                    >
                      {skipping === item ? 'Skipping…' : 'Skip concern'}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {skippedConflicts.length > 0 && (
        <div className="ai-guideline-skipped">
          <strong>Skipped guideline concerns</strong>
          <ul>
            {skippedConflicts.map(({ conflict, skip }) => (
              <li key={conflict}>
                <span className="ai-guideline-text">{conflict}</span>
                <span className="claim-panel-meta">
                  {' '}
                  — skipped
                  {skip.skippedBy ? ` by ${skip.skippedBy}` : ''}
                  {skip.note ? ` · ${skip.note}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="field-error">{error}</p>}

      {analysis.flags.length > 0 && (
        <div className="ai-flags">
          <strong>Flags</strong>
          <ul>
            {analysis.flags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </div>
      )}

      {analysis.fraudIndicators.length > 0 && (
        <div className="ai-fraud">
          <strong>Fraud indicators</strong>
          <ul>
            {analysis.fraudIndicators.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="ai-model">Model: {analysis.model}</p>
    </div>
  );
}
