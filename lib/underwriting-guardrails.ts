/**
 * Auto-approve safety gates applied after rules pass and AI recommends approve.
 * Tighten these to push more claims to human review.
 */
export const AUTO_APPROVE_MAX_RISK = 4;
export const AUTO_APPROVE_MIN_CONFIDENCE = 80;

export type GuardrailCheckInput = {
  riskScore: number;
  confidence: number;
  fraudIndicators: string[];
  informationRequests: string[];
  guidelineConflicts: string[];
  recommendation: 'approve' | 'deny' | 'review';
};

export type GuardrailResult = {
  allowed: boolean;
  reasons: string[];
};

/**
 * Returns whether a clean AI "approve" may become a final approved decision.
 * Call only when contract rules already passed.
 */
export function checkAutoApproveGuardrails(
  ai: GuardrailCheckInput
): GuardrailResult {
  const reasons: string[] = [];

  if (ai.recommendation !== 'approve') {
    reasons.push(`AI recommendation is "${ai.recommendation}", not approve`);
  }

  if (ai.riskScore > AUTO_APPROVE_MAX_RISK) {
    reasons.push(
      `Risk score ${ai.riskScore}/10 exceeds auto-approve max of ${AUTO_APPROVE_MAX_RISK}`
    );
  }

  if (ai.confidence < AUTO_APPROVE_MIN_CONFIDENCE) {
    reasons.push(
      `Confidence ${ai.confidence}% is below auto-approve minimum of ${AUTO_APPROVE_MIN_CONFIDENCE}%`
    );
  }

  if (ai.fraudIndicators.length > 0) {
    reasons.push(
      `Fraud indicators present: ${ai.fraudIndicators.slice(0, 3).join('; ')}`
    );
  }

  if (ai.informationRequests.length > 0) {
    reasons.push(
      `Information still needed: ${ai.informationRequests.slice(0, 3).join('; ')}`
    );
  }

  if (ai.guidelineConflicts.length > 0) {
    reasons.push(
      `Guideline conflicts: ${ai.guidelineConflicts.slice(0, 3).join('; ')}`
    );
  }

  return { allowed: reasons.length === 0, reasons };
}
