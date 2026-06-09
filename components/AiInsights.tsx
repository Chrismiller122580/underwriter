import type { AiAnalysis } from '@/lib/ai-types';

function riskClass(score: number) {
  if (score >= 8) return 'risk-high';
  if (score >= 5) return 'risk-medium';
  return 'risk-low';
}

function formatCheck(value: boolean | null | undefined, label: string) {
  if (value === null || value === undefined) return null;
  return `${label}: ${value ? 'Yes' : 'No'}`;
}

export function AiInsights({ analysis }: { analysis: AiAnalysis }) {
  const checks = [
    formatCheck(analysis.contractValid, 'Contract valid'),
    formatCheck(analysis.waitingPeriodMet, 'Waiting period met'),
    formatCheck(analysis.componentCovered, 'Component covered'),
    formatCheck(analysis.maintenanceConcern, 'Maintenance concern'),
    formatCheck(analysis.inspectionRecommended, 'Inspection recommended'),
  ].filter(Boolean);

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

      {(analysis.guidelineConflicts?.length ?? 0) > 0 && (
        <div className="ai-guideline-conflicts">
          <strong>Guideline concerns</strong>
          <ul>
            {analysis.guidelineConflicts!.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

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