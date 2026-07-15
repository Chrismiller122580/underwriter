import { NextResponse } from 'next/server';
import { z } from 'zod';
import { canUnderwrite, getSessionFromCookies } from '@/lib/auth';
import {
  isValidClaimId,
  manualDecisionOnClaim,
} from '@/lib/claims-store';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: { id: string };
};

const bodySchema = z.object({
  decision: z.enum(['approved', 'denied', 'under_review']),
  reason: z.string().min(10).max(2000),
});

export async function POST(request: Request, context: RouteContext) {
  const { id } = context.params;

  const session = await getSessionFromCookies();
  if (!session || !canUnderwrite(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isValidClaimId(id)) {
    return NextResponse.json({ error: 'Invalid claim ID' }, { status: 400 });
  }

  try {
    const body = bodySchema.parse(await request.json());
    const claim = await manualDecisionOnClaim(id, {
      decision: body.decision,
      reason: body.reason,
      decidedBy: session.email,
      decidedByRole: session.role,
    });

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    logger.info('Manual claim decision', {
      claimId: id,
      decision: body.decision,
      role: session.role,
    });

    return NextResponse.json({
      id: claim._id,
      status: claim.status,
      underwriting: claim.underwriting,
      infoRequest: claim.infoRequest ?? null,
      updatedAt: claim.updatedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error:
            'Invalid decision body — decision must be approved|denied|under_review and reason ≥ 10 characters',
        },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message.includes('reason must')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    logger.error('Manual decision failed', {
      claimId: id,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'Failed to record manual decision' },
      { status: 500 }
    );
  }
}
