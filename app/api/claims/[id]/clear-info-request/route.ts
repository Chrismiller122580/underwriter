import { NextResponse } from 'next/server';
import { canUnderwrite, getSessionFromCookies } from '@/lib/auth';
import {
  clearInfoRequestOnClaim,
  isValidClaimId,
} from '@/lib/claims-store';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: { id: string };
};

export async function POST(_request: Request, context: RouteContext) {
  const { id } = context.params;

  const session = await getSessionFromCookies();
  if (!session || !canUnderwrite(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isValidClaimId(id)) {
    return NextResponse.json({ error: 'Invalid claim ID' }, { status: 400 });
  }

  try {
    const claim = await clearInfoRequestOnClaim(id);
    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    logger.info('Info request cleared', {
      claimId: id,
      status: claim.status,
      role: session.role,
    });

    return NextResponse.json({
      id: claim._id,
      status: claim.status,
      infoRequest: claim.infoRequest ?? null,
      updatedAt: claim.updatedAt,
    });
  } catch (error) {
    logger.error('Clear info request failed', {
      claimId: id,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'Failed to clear information request' },
      { status: 500 }
    );
  }
}
