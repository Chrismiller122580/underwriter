import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { getClaimById, isValidClaimId } from '@/lib/claims-store';
import { sanitizeClaimForPortal } from '@/lib/document-urls';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isValidClaimId(id)) {
      return NextResponse.json({ error: 'Invalid claim ID' }, { status: 400 });
    }

    const claim = await getClaimById(id);
    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    return NextResponse.json({ claim: sanitizeClaimForPortal(claim) });
  } catch (error) {
    logger.error('GET /api/claims/[id] failed', {
      claimId: id,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'Failed to fetch claim' },
      { status: 500 }
    );
  }
}
