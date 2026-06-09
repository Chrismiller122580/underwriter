'use client';

import { useState } from 'react';
import { UnderwriteButton } from '@/app/claims/UnderwriteButton';
import { getContractDisplayName } from '@/lib/contracts/registry';
import {
  claimNeedsAction,
  claimPriorityScore,
  getAttachedDocuments,
  getContractBrief,
  getContractRulePreview,
  getMissingDocuments,
  getUnderwritingReadiness,
  type PortalClaim,
} from '@/lib/claim-portal';
import { AiInsights } from './AiInsights';
import { AnalyzeButton } from './AnalyzeButton';

function statusClass(status: string) {
  return `status-pill status-${status}`;
}

function riskBadge(score: number) {
  if (score >= 8) return 'risk-high';
  if (score >= 5) return 'risk-medium';
  return 'risk-low';
}

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function recommendationClass(value?: string) {
  if (value === 'deny') return 'rec-deny';
  if (value === 'review') return 'rec-review';
  if (value === 'approve') return 'rec-approve';
  return '';
}

export function ClaimCard({
  claim,
  onRefresh,
  defaultExpanded = false,
}: {
  claim: PortalClaim;
  onRefresh: () => void;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const priority = claimPriorityScore(claim);
  const missingDocs = getMissingDocuments(claim);
  const attachedDocs = getAttachedDocuments(claim);
  const contractBrief = getContractBrief(claim.policyInformation.contractType);
  const rulePreview = getContractRulePreview(claim);
  const readiness = getUnderwritingReadiness(claim);
  const needsAction = claimNeedsAction(claim);

  return (
    <article
      className={`claim-card claim-workbench-card${
        needsAction ? ' claim-needs-action' : ''
      }`}
    >
      <div className="claim-card-top">
        <div className="claim-card-identity">
          <div className="claim-card-title-row">
            <h3>{claim.claimantInformation.name}</h3>
            {needsAction && (
              <span className="claim-priority-badge">Priority {priority}</span>
            )}
          </div>
          <p className="claim-meta">
            {claim.vehicleInfo.year} {claim.vehicleInfo.make}{' '}
            {claim.vehicleInfo.model} · {claim.vehicleInfo.odometerReading.toLocaleString()}{' '}
            mi
          </p>
          <p className="claim-meta claim-meta-sub">VIN {claim.vehicleInfo.vin}</p>
        </div>

        <div className="claim-card-metrics">
          <div className="claim-amount-block">
            <span className="claim-amount-label">Claim amount</span>
            <span className="claim-amount-value">
              ${claim.claimDetails.amount.toLocaleString()}
            </span>
          </div>
          <div className="claim-badges">
            {claim.aiAnalysis && (
              <span
                className={`risk-score ${riskBadge(claim.aiAnalysis.riskScore)}`}
              >
                Risk {claim.aiAnalysis.riskScore}/10
              </span>
            )}
            {claim.aiAnalysis?.recommendation && (
              <span
                className={`ai-rec-pill ${recommendationClass(claim.aiAnalysis.recommendation)}`}
              >
                AI: {claim.aiAnalysis.recommendation}
              </span>
            )}
            <span className={statusClass(claim.status)}>
              {claim.status.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>

      <div className={`claim-next-action claim-next-action-${readiness.tone}`}>
        <strong>Next step:</strong> {readiness.nextAction}
      </div>

      <div className="claim-signal-row">
        {(claim.aiAnalysis?.informationRequests?.length ?? 0) > 0 && (
          <span className="claim-signal claim-signal-info">
            {claim.aiAnalysis!.informationRequests!.length} info request
            {claim.aiAnalysis!.informationRequests!.length === 1 ? '' : 's'}
          </span>
        )}
        {(claim.aiAnalysis?.guidelineConflicts?.length ?? 0) > 0 && (
          <span className="claim-signal claim-signal-guideline">
            Guideline flag
          </span>
        )}
        {missingDocs.length > 0 && (
          <span className="claim-signal claim-signal-docs">
            {missingDocs.length} doc gap{missingDocs.length === 1 ? '' : 's'}
          </span>
        )}
        {!claim.aiAnalysis && (
          <span className="claim-signal claim-signal-pending-ai">No AI scan</span>
        )}
        <span className={`claim-signal claim-signal-rule rule-${rulePreview.decision}`}>
          Rules: {rulePreview.decision}
        </span>
      </div>

      <div className="claim-fact-strip">
        <div className="claim-fact">
          <span className="claim-fact-label">Policy</span>
          <span className="claim-fact-value">{claim.policyInformation.policyNumber}</span>
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
        </div>
        <div className="claim-fact">
          <span className="claim-fact-label">Loss date</span>
          <span className="claim-fact-value">
            {formatDate(claim.incidentDetails.dateOfLoss)}
          </span>
        </div>
        <div className="claim-fact">
          <span className="claim-fact-label">Documents</span>
          <span className="claim-fact-value">
            {attachedDocs.length} attached · {missingDocs.length} missing
          </span>
        </div>
        <div className="claim-fact">
          <span className="claim-fact-label">Submitted</span>
          <span className="claim-fact-value">{formatDate(claim.createdAt)}</span>
        </div>
      </div>

      <p className="claim-repair-snippet">
        <strong>Repair:</strong> {claim.repairInformation.detailedRepairDescription}
      </p>

      {expanded && (
        <div className="claim-expanded">
          <div className="claim-expanded-grid">
            <section className="claim-panel claim-panel-rules">
              <h4>Contract rules engine</h4>
              <p className={`rule-decision rule-decision-${rulePreview.decision}`}>
                {rulePreview.decision.toUpperCase()}
              </p>
              <p>{rulePreview.reason}</p>
              {rulePreview.flags.length > 0 && (
                <ul>
                  {rulePreview.flags.map((flag) => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              )}
              {rulePreview.denialCategory && (
                <p className="claim-panel-meta">
                  Denial category: {rulePreview.denialCategory.replace('_', ' ')}
                </p>
              )}
            </section>

            <section className="claim-panel">
              <h4>Contract context</h4>
              <p className="claim-panel-title">{contractBrief.title}</p>
              <ul>
                {contractBrief.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="claim-panel-meta">
                Effective {formatDate(claim.policyInformation.policyEffectiveDate)} –{' '}
                {formatDate(claim.policyInformation.policyExpirationDate)}
              </p>
            </section>

            <section className="claim-panel">
              <h4>Incident &amp; claimant</h4>
              <p>{claim.incidentDetails.descriptionOfIncident}</p>
              <p className="claim-panel-meta">
                {claim.incidentDetails.locationOfIncident} ·{' '}
                {claim.claimantInformation.contactInformation}
              </p>
              <p className="claim-panel-meta">
                Shop: {claim.repairInformation.repairShopInformation}
              </p>
            </section>

            <section className="claim-panel">
              <h4>Documentation status</h4>
              {attachedDocs.length > 0 ? (
                <ul className="claim-doc-list">
                  {attachedDocs.map((doc) => (
                    <li key={doc.field}>
                      <a href={doc.url} target="_blank" rel="noreferrer">
                        {doc.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="claim-panel-meta">No files attached at submission.</p>
              )}
              {missingDocs.length > 0 && (
                <>
                  <p className="claim-panel-subhead">Missing (AI may request)</p>
                  <ul className="claim-doc-missing">
                    {missingDocs.map((doc) => (
                      <li key={doc.field}>{doc.label}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>

          {readiness.warnings.length > 0 && (
            <div className="claim-readiness-warnings">
              <strong>Underwriting notes</strong>
              <ul>
                {readiness.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {claim.aiAnalysis && <AiInsights analysis={claim.aiAnalysis} />}

          {claim.underwriting?.reason && (
            <div className="underwriting-decision-box">
              <strong>Last underwriting decision</strong>
              <p>{claim.underwriting.reason}</p>
              {claim.underwriting.reviewedAt && (
                <span className="claim-panel-meta">
                  Reviewed {formatDate(claim.underwriting.reviewedAt)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="claim-card-actions">
        <button
          type="button"
          className="link-button claim-expand-toggle"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Hide full context' : 'Show full claim context'}
        </button>

        <div className="claim-action-group">
          <AnalyzeButton
            claimId={claim._id}
            onComplete={onRefresh}
            label={claim.aiAnalysis ? 'Refresh AI Scan' : 'Run AI Scan'}
          />
          {readiness.canUnderwrite ? (
            <UnderwriteButton claimId={claim._id} onComplete={onRefresh} />
          ) : (
            <span className="done-label">
              {readiness.blockers[0] ?? `${claim.status} — underwriting unavailable`}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}