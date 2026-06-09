import type { ClaimRecord } from '@/lib/claims-store';
import type { AiAnalysis } from '@/lib/ai-types';

export function heuristicAnalysis(claim: ClaimRecord): AiAnalysis {
  const flags: string[] = [];
  const fraudIndicators: string[] = [];
  let riskScore = 3;

  const now = new Date();
  const effective = new Date(claim.policyInformation.policyEffectiveDate);
  const expiration = new Date(claim.policyInformation.policyExpirationDate);
  const lossDate = new Date(claim.incidentDetails.dateOfLoss);
  const vehicleAge = now.getFullYear() - claim.vehicleInfo.year;
  const estimate = claim.repairInformation.repairEstimate;
  const desc = claim.incidentDetails.descriptionOfIncident.toLowerCase();

  if (now < effective || now > expiration) {
    flags.push('Policy is not currently active');
    riskScore += 3;
  }

  if (lossDate < effective || lossDate > expiration) {
    flags.push('Date of loss falls outside policy period');
    riskScore += 3;
  }

  if (estimate > 15000) {
    flags.push('Repair estimate exceeds $15,000 threshold');
    riskScore += 2;
  }

  if (vehicleAge > 12 && estimate > 8000) {
    flags.push('High repair cost relative to vehicle age');
    riskScore += 2;
  }

  if (claim.vehicleInfo.odometerReading > 200000) {
    flags.push('Very high odometer reading');
    riskScore += 1;
  }

  const fraudKeywords = ['staged', 'intentional', 'fraud', 'fake', 'prior damage'];
  if (fraudKeywords.some((k) => desc.includes(k))) {
    fraudIndicators.push('Incident description contains suspicious language');
    riskScore += 2;
  }

  if (estimate > 0 && desc.length < 20) {
    flags.push('Incident description is unusually brief for the repair amount');
    riskScore += 1;
  }

  if ((claim.claimDetails.documents?.length ?? 0) < 3) {
    flags.push('Fewer than 3 supporting documents attached');
    riskScore += 1;
  }

  riskScore = Math.min(10, Math.max(1, riskScore));

  let recommendation: AiAnalysis['recommendation'] = 'approve';
  if (riskScore >= 8 || flags.some((f) => f.includes('not currently active') || f.includes('outside policy'))) {
    recommendation = 'deny';
  } else if (riskScore >= 5 || fraudIndicators.length > 0) {
    recommendation = 'review';
  }

  const reasoning =
    recommendation === 'deny'
      ? 'Rule-based analysis found critical policy or eligibility issues that warrant denial.'
      : recommendation === 'review'
        ? 'Claim has risk factors that require adjuster review before approval.'
        : 'Claim passes automated checks with acceptable risk profile.';

  return {
    summary: `${claim.claimantInformation.name} filed a $${estimate.toLocaleString()} claim for a ${claim.vehicleInfo.year} ${claim.vehicleInfo.make} ${claim.vehicleInfo.model} after an incident on ${lossDate.toLocaleDateString()}.`,
    riskScore,
    recommendation,
    reasoning,
    flags,
    fraudIndicators,
    confidence: 65,
    analyzedAt: new Date().toISOString(),
    model: 'heuristic-v1',
  };
}