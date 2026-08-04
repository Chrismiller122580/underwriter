import { NextResponse } from 'next/server';
import { z } from 'zod';
import { canUnderwrite, getSessionFromCookies } from '@/lib/auth';
import {
  isValidClaimId,
  skipGuidelineOnClaim,
} from '@/lib/claims-store';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const bodySchema = z.object({
  conflict: z.string().min(1).max(2000),
  note: z.string().max(500).optional(),
});

/**
 * POST /api/claims/[id]/skip-guideline
 * Staff dismisses an AI guideline concern so it no longer blocks underwriting.
 */
export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const session = await getSessionFromCookies();
  if (!session || !canUnderwrite(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isValidClaimId(id)) {
    return NextResponse.json({ error: 'Invalid claim ID' }, { status: 400 });
  }

  try {
    const body = bodySchema.parse(await request.json());
    const claim = await skipGuidelineOnClaim(id, {
      conflict: body.conflict,
      note: body.note,
      skippedBy: session.email,
      skippedByRole: session.role,
    });

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    logger.info('Guideline concern skipped', {
      claimId: id,
      role: session.role,
      conflictPreview: body.conflict.slice(0, 120),
    });

    return NextResponse.json({
      id: claim._id,
      guidelineSkips: claim.guidelineSkips ?? [],
      message: 'Guideline concern skipped',
      updatedAt: claim.updatedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Provide the guideline conflict text to skip' },
        { status: 400 }
      );
    }
    if (
      error instanceof Error &&
      (error.message.includes('not on this claim') ||
        error.message.includes('required'))
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    logger.error('POST skip-guideline failed', {
      claimId: id,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'Failed to skip guideline concern' },
      { status: 500 }
    );
  }
}
