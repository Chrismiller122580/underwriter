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