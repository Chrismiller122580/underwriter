import type { ClaimRecord } from '@/lib/claims-store';
import type { AiAnalysis } from '@/lib/ai-types';
import { FILE_FIELD_LABELS, FILE_FIELDS } from '@/lib/parse-claim-form';

function missingDocumentRequests(claim: ClaimRecord): string[] {
  const attached = claim.claimDetails.attachedDocuments ?? {};
  const requests: string[] = [];

  for (const field of FILE_FIELDS) {
    if (attached[field]) continue;

    switch (field) {
      case 'maintenanceRecords':
      case 'serviceHistory':
        requests.push(
          `Please provide ${FILE_FIELD_LABELS[field]} to verify maintenance requirements under Freedom Warranty guidelines.`
        );
        break;
      case 'inspectionReports':
        requests.push(
          `Please provide ${FILE_FIELD_LABELS[field]} if available to support component failure assessment.`
        );
        break;
      case 'priorClaimsHistory':
        requests.push(
          `Please provide ${FILE_FIELD_LABELS[field]} to confirm the component was not previously replaced.`
        );
        break;
      case 'proofOfOwnership':
        requests.push(
          `Please provide ${FILE_FIELD_LABELS[field]} to verify vehicle ownership if not already on file.`
        );
        break;
    }
  }

  return requests;
}

export function heuristicAnalysis(claim: ClaimRecord): AiAnalysis {
  const flags: string[] = [];
  const fraudIndicators: string[] = [];
  const guidelineConflicts: string[] = [];
  const informationRequests = missingDocumentRequests(claim);
  let riskScore = 3;

  const now = new Date();
  const effective = new Date(claim.policyInformation.policyEffectiveDate);
  const expiration = new Date(claim.policyInformation.policyExpirationDate);
  const lossDate = new Date(claim.incidentDetails.dateOfLoss);
  const vehicleAge = now.getFullYear() - claim.vehicleInfo.year;
  const estimate = claim.repairInformation.repairEstimate;
  const desc = claim.incidentDetails.descriptionOfIncident.toLowerCase();
  const repairDesc = claim.repairInformation.detailedRepairDescription.toLowerCase();
  const attachedCount = Object.keys(claim.claimDetails.attachedDocuments ?? {}).length;

  if (now < effective || now > expiration) {
    flags.push('Policy is not currently active');
    guidelineConflicts.push('Claim filed outside active contract period per validity rules.');
    riskScore += 3;
  }

  if (lossDate < effective || lossDate > expiration) {
    flags.push('Date of loss falls outside policy period');
    guidelineConflicts.push('Date of loss conflicts with contract effective/expiration dates.');
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

  const needsMaintenanceProof =
    repairDesc.includes('engine') ||
    repairDesc.includes('transmission') ||
    repairDesc.includes('turbo');
  if (
    needsMaintenanceProof &&
    !claim.claimDetails.attachedDocuments?.maintenanceRecords &&
    !claim.claimDetails.attachedDocuments?.serviceHistory
  ) {
    flags.push('Major component repair without maintenance or service records');
    guidelineConflicts.push(
      'Maintenance validation cannot be completed without maintenance or service history per underwriting guidelines.'
    );
    riskScore += 2;
  }

  if (attachedCount === 0) {
    flags.push('No supporting documents attached at submission');
  }

  riskScore = Math.min(10, Math.max(1, riskScore));

  let recommendation: AiAnalysis['recommendation'] = 'approve';
  if (
    riskScore >= 8 ||
    flags.some((f) => f.includes('not currently active') || f.includes('outside policy'))
  ) {
    recommendation = 'deny';
  } else if (
    riskScore >= 5 ||
    fraudIndicators.length > 0 ||
    informationRequests.length > 0 ||
    guidelineConflicts.length > 0
  ) {
    recommendation = 'review';
  }

  const reasoning =
    recommendation === 'deny'
      ? 'Rule-based analysis found critical policy or eligibility issues that warrant denial.'
      : recommendation === 'review'
        ? informationRequests.length > 0
          ? 'Claim needs additional information before it can be fully evaluated against underwriting guidelines.'
          : 'Claim has risk factors that require adjuster review before approval.'
        : 'Claim passes automated checks with acceptable risk profile.';

  const contractType = claim.policyInformation.contractType ?? 'unknown';

  return {
    summary: `${claim.claimantInformation.name} filed a $${estimate.toLocaleString()} claim for a ${claim.vehicleInfo.year} ${claim.vehicleInfo.make} ${claim.vehicleInfo.model} after an incident on ${lossDate.toLocaleDateString()}.`,
    riskScore,
    recommendation,
    reasoning,
    flags,
    fraudIndicators,
    confidence: 65,
    contractValid: !flags.some(
      (f) => f.includes('not currently active') || f.includes('outside policy')
    ),
    waitingPeriodMet: null,
    componentCovered: null,
    maintenanceConcern:
      needsMaintenanceProof &&
      !claim.claimDetails.attachedDocuments?.maintenanceRecords
        ? true
        : null,
    inspectionRecommended: estimate > 5000 ? true : null,
    denialCategory:
      recommendation === 'deny' && flags.some((f) => f.includes('outside policy'))
        ? 'invalid_contract'
        : null,
    informationRequests,
    guidelineConflicts,
    analyzedAt: new Date().toISOString(),
    model: `heuristic-v1${contractType !== 'unknown' ? `/${contractType}` : ''}`,
  };
}