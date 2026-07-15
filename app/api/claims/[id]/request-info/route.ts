import { NextResponse } from 'next/server';
import { z } from 'zod';
import { canUnderwrite, getSessionFromCookies } from '@/lib/auth';
import {
  ClaimNotUnderwritableError,
  isValidClaimId,
  requestInfoOnClaim,
} from '@/lib/claims-store';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: { id: string };
};

const bodySchema = z.object({
  items: z.array(z.string().min(1).max(500)).min(1).max(20),
  note: z.string().max(2000).optional(),
  source: z.enum(['manual', 'ai_suggested']).optional(),
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
    const claim = await requestInfoOnClaim(id, {
      items: body.items,
      note: body.note,
      requestedBy: session.email,
      source: body.source ?? 'manual',
    });

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    logger.info('Info requested on claim', {
      claimId: id,
      itemCount: body.items.length,
      role: session.role,
    });

    return NextResponse.json({
      id: claim._id,
      status: claim.status,
      infoRequest: claim.infoRequest,
      updatedAt: claim.updatedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body — provide 1–20 info items' },
        { status: 400 }
      );
    }
    if (error instanceof ClaimNotUnderwritableError) {
      return NextResponse.json(
        {
          error: `Cannot request info while claim status is "${error.claim.status}".`,
          status: error.claim.status,
        },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message.includes('At least one')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    logger.error('Request info failed', {
      claimId: id,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'Failed to request information' },
      { status: 500 }
    );
  }
}
