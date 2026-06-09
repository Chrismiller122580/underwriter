import { NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeClaimWithAi } from '@/lib/ai-underwrite';
import { evaluateContractRules } from '@/lib/contract-rules';
import { canManageKnowledge, getSessionFromCookies } from '@/lib/auth';
import { getClaimById, isValidClaimId } from '@/lib/claims-store';
import {
  buildSandboxClaim,
  sandboxScenarioSchema,
} from '@/lib/sandbox-claim';
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

    const [ruleResult, aiAnalysis] = await Promise.all([
      Promise.resolve(evaluateContractRules(claim)),
      analyzeClaimWithAi(claim),
    ]);

    return NextResponse.json({
      claimId: claim._id,
      contractType: claim.policyInformation.contractType,
      ruleResult,
      aiAnalysis,
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