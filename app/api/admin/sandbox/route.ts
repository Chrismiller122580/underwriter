import { NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeClaimWithAi } from '@/lib/ai-underwrite';
import { evaluateContractRules } from '@/lib/contract-rules';
import { canManageKnowledge, getSessionFromCookies } from '@/lib/auth';
import {
  getClaimById,
  getPolicyHistoryForClaim,
  isValidClaimId,
} from '@/lib/claims-store';
import {
  buildSandboxClaim,
  sandboxScenarioSchema,
} from '@/lib/sandbox-claim';
import { buildPolicyHistoryContext } from '@/lib/policy-history';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const bodySchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('claim'),
    claimId: z.string().uuid(),
  }),
  z.object({
    mode: z.literal('scenario'),
    scenario: sandboxScenarioSchema.partial().optional(),
  }),
]);

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session || !canManageKnowledge(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = bodySchema.parse(await request.json());

    let claim;
    if (body.mode === 'claim') {
      if (!isValidClaimId(body.claimId)) {
        return NextResponse.json({ error: 'Invalid claim ID' }, { status: 400 });
      }
      claim = await getClaimById(body.claimId);
      if (!claim) {
        return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
      }
    } else {
      const scenario = sandboxScenarioSchema.parse({
        ...sandboxScenarioSchema.parse({}),
        ...body.scenario,
      });
      claim = buildSandboxClaim(scenario);
    }

    const policyHistory =
      body.mode === 'claim'
        ? await getPolicyHistoryForClaim(claim)
        : buildPolicyHistoryContext(
            claim.policyInformation.policyNumber,
            claim.policyInformation.contractType,
            claim.repairInformation.repairEstimate,
            []
          );

    const [ruleResult, aiAnalysis] = await Promise.all([
      Promise.resolve(evaluateContractRules(claim, { policyHistory })),
      analyzeClaimWithAi(claim, { policyHistory }),
    ]);

    return NextResponse.json({
      claimId: claim._id,
      contractType: claim.policyInformation.contractType,
      ruleResult,
      aiAnalysis,
      policyHistory: {
        approvedAggregate: policyHistory.approvedAggregate,
        openAggregate: policyHistory.openAggregate,
        maxAggregate: policyHistory.maxAggregate,
        remainingAfterApproved: policyHistory.remainingAfterApproved,
        wouldExceedAggregate: policyHistory.wouldExceedAggregate,
        relatedClaimCount: policyHistory.relatedClaims.length,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid sandbox input' }, { status: 400 });
    }

    logger.error('POST /api/admin/sandbox failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Sandbox analysis failed' }, { status: 500 });
  }
}