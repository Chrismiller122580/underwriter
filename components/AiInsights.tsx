type AiAnalysis = {
  summary: string;
  riskScore: number;
  recommendation: string;
  reasoning: string;
  flags: string[];
  fraudIndicators: string[];
  confidence: number;
  model: string;
};

function riskClass(score: number) {
  if (score >= 8) return 'risk-high';
  if (score >= 5) return 'risk-medium';
  return 'risk-low';
}

export function AiInsights({ analysis }: { analysis: AiAnalysis }) {
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
      </p>

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