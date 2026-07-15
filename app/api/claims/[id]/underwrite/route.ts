import { NextResponse } from 'next/server';
import {
  canUnderwrite,
  getSessionFromCookies,
} from '@/lib/auth';
import {
  ClaimNotUnderwritableError,
  isValidClaimId,
  underwriteClaimById,
} from '@/lib/claims-store';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: { id: string };
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = context.params;
  const force = new URL(request.url).searchParams.get('force') === 'true';

  const session = await getSessionFromCookies();
  if (!session || !canUnderwrite(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isValidClaimId(id)) {
    return NextResponse.json({ error: 'Invalid claim ID' }, { status: 400 });
  }

  try {
    const outcome = await underwriteClaimById(id, { force });
    if (!outcome) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const { claim, result, aiAnalysis, ruleResult, policyHistory } = outcome;

    logger.info('Claim underwritten', {
      claimId: id,
      decision: result.decision,
      role: session.role,
      aiReused: outcome.aiReused,
      componentStatus: ruleResult.componentCoverage?.status,
      approvedAggregate: policyHistory.approvedAggregate,
    });

    return NextResponse.json({
      id: claim._id,
      decision: result.decision,
      reason: result.reason,
      status: claim.status,
      underwriting: claim.underwriting,
      aiAnalysis,
      aiReused: outcome.aiReused,
      ruleResult: {
        decision: ruleResult.decision,
        reason: ruleResult.reason,
        flags: ruleResult.flags,
        denialCategory: ruleResult.denialCategory,
        componentCoverage: ruleResult.componentCoverage,
      },
      policyHistory: {
        policyNumber: policyHistory.policyNumber,
        approvedAggregate: policyHistory.approvedAggregate,
        openAggregate: policyHistory.openAggregate,
        maxAggregate: policyHistory.maxAggregate,
        remainingAfterApproved: policyHistory.remainingAfterApproved,
        wouldExceedAggregate: policyHistory.wouldExceedAggregate,
        relatedClaimCount: policyHistory.relatedClaims.length,
        priorApprovedRepairs: policyHistory.priorApprovedRepairs,
      },
    });
  } catch (error) {
    if (error instanceof ClaimNotUnderwritableError) {
      return NextResponse.json(
        {
          error: `Claim cannot be underwritten while status is "${error.claim.status}".`,
          status: error.claim.status,
        },
        { status: 409 }
      );
    }

    logger.error('Underwrite failed', {
      claimId: id,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'Failed to underwrite claim' },
      { status: 500 }
    );
  }
}