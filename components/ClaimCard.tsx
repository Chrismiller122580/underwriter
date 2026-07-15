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
import type { ClaimRecord } from '@/lib/claims-store';
import { AiInsights } from './AiInsights';
import { AnalyzeButton } from './AnalyzeButton';
import { ClaimTimeline } from './ClaimTimeline';
import { ManualDecisionButton } from './ManualDecisionButton';
import { RequestInfoButton } from './RequestInfoButton';

export type ClaimPatch = {
  _id: string;
  status?: string;
  aiAnalysis?: ClaimRecord['aiAnalysis'];
  underwriting?: ClaimRecord['underwriting'];
  infoRequest?: ClaimRecord['infoRequest'] | null;
  updatedAt?: string;
};

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
  onClaimUpdated,
  defaultExpanded = false,
}: {
  claim: PortalClaim;
  onClaimUpdated: (patch: ClaimPatch) => void;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [timelineKey, setTimelineKey] = useState(0);
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
        {(claim.infoRequest?.items?.length ?? 0) > 0 && (
          <span className="claim-signal claim-signal-info">
            Info requested ({claim.infoRequest!.items.length})
          </span>
        )}
        {(claim.aiAnalysis?.informationRequests?.length ?? 0) > 0 &&
          !(claim.infoRequest?.items?.length ?? 0) && (
          <span className="claim-signal claim-signal-info">
            {claim.aiAnalysis!.informationRequests!.length} AI info suggest
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
        {rulePreview.componentCoverage && (
          <span
            className={`claim-signal claim-signal-component component-${rulePreview.componentCoverage.status}`}
            title={rulePreview.componentCoverage.flags.join(' · ')}
          >
            Component: {rulePreview.componentCoverage.status.replace('_', ' ')}
            {rulePreview.componentCoverage.matchedLabel
              ? ` · ${rulePreview.componentCoverage.matchedLabel}`
              : ''}
          </span>
        )}
      </div>

      <div className="claim-fact-strip">
        <div className="claim-fact">
          <span className="claim-fact-label">Tracking</span>
          <span className="claim-fact-value">
            {claim.publicToken ?? '—'}
          </span>
        </div>
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
              {rulePreview.componentCoverage && (
                <p className="claim-panel-meta">
                  Component pre-check:{' '}
                  <strong>
                    {rulePreview.componentCoverage.status.replace('_', ' ')}
                  </strong>
                  {rulePreview.componentCoverage.matchedLabel
                    ? ` (${rulePreview.componentCoverage.matchedLabel})`
                    : ''}
                </p>
              )}
              {rulePreview.laborRateCheck && (
                <p className="claim-panel-meta">
                  Labor class {rulePreview.laborRateCheck.vehicleClass}
                  {rulePreview.laborRateCheck.laborRate != null
                    ? ` · $${rulePreview.laborRateCheck.laborRate}/hr parsed`
                    : ' · no labor rate in text'}
                  {rulePreview.laborRateCheck.diagnosticHours != null
                    ? ` · diag ${rulePreview.laborRateCheck.diagnosticHours}h`
                    : ''}
                  {rulePreview.laborRateCheck.needsReview
                    ? ' · holds for review'
                    : ''}
                </p>
              )}
              <p className="claim-panel-meta">
                Aggregate LOL is evaluated at underwrite time from prior claims on
                this policy number.
              </p>
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

          {claim.infoRequest?.items?.length ? (
            <div className="info-request-box">
              <strong>Open information request</strong>
              <ul>
                {claim.infoRequest.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {claim.infoRequest.note && (
                <p className="claim-panel-meta">Note: {claim.infoRequest.note}</p>
              )}
              {claim.infoRequest.requestedAt && (
                <span className="claim-panel-meta">
                  Requested {formatDate(claim.infoRequest.requestedAt)}
                  {claim.infoRequest.requestedBy
                    ? ` · ${claim.infoRequest.requestedBy}`
                    : ''}
                </span>
              )}
            </div>
          ) : null}

          {claim.underwriting?.reason && (
            <div className="underwriting-decision-box">
              <strong>
                Last decision
                {claim.underwriting.source
                  ? ` (${claim.underwriting.source})`
                  : ''}
              </strong>
              <p>{claim.underwriting.reason}</p>
              {claim.underwriting.reviewedAt && (
                <span className="claim-panel-meta">
                  Reviewed {formatDate(claim.underwriting.reviewedAt)}
                  {claim.underwriting.decidedBy
                    ? ` · ${claim.underwriting.decidedBy}`
                    : ''}
                </span>
              )}
            </div>
          )}

          <ClaimTimeline claimId={claim._id} refreshKey={timelineKey} />
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
            force={Boolean(claim.aiAnalysis)}
            onComplete={(result) => {
              onClaimUpdated({
                _id: claim._id,
                aiAnalysis: result.aiAnalysis,
                updatedAt: new Date().toISOString(),
              });
              setTimelineKey((k) => k + 1);
            }}
            label={claim.aiAnalysis ? 'Refresh AI Scan' : 'Run AI Scan'}
          />
          {(claim.status === 'pending' ||
            claim.status === 'under_review' ||
            claim.status === 'needs_info') && (
            <RequestInfoButton
              claimId={claim._id}
              suggestedItems={claim.aiAnalysis?.informationRequests ?? []}
              existingRequest={claim.infoRequest}
              onComplete={(result) => {
                onClaimUpdated({
                  _id: claim._id,
                  status: result.status,
                  infoRequest: result.infoRequest,
                  updatedAt: result.updatedAt ?? new Date().toISOString(),
                });
                setTimelineKey((k) => k + 1);
              }}
            />
          )}
          {readiness.canUnderwrite ? (
            <UnderwriteButton
              claimId={claim._id}
              onComplete={(result) => {
                onClaimUpdated({
                  _id: claim._id,
                  status: result.status,
                  aiAnalysis: result.aiAnalysis,
                  underwriting: result.underwriting,
                  updatedAt: new Date().toISOString(),
                });
                setTimelineKey((k) => k + 1);
              }}
            />
          ) : (
            <span className="done-label">
              {readiness.blockers[0] ?? `${claim.status} — underwriting unavailable`}
            </span>
          )}
          <ManualDecisionButton
            claimId={claim._id}
            currentStatus={claim.status}
            onComplete={(result) => {
              onClaimUpdated({
                _id: claim._id,
                status: result.status,
                underwriting: result.underwriting,
                infoRequest: result.infoRequest,
                updatedAt: result.updatedAt ?? new Date().toISOString(),
              });
              setTimelineKey((k) => k + 1);
            }}
          />
        </div>
      </div>
    </article>
  );
}