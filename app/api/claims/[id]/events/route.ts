import { NextResponse } from 'next/server';
import { canUnderwrite, getSessionFromCookies } from '@/lib/auth';
import { listClaimEvents } from '@/lib/claim-events';
import { getClaimById, isValidClaimId } from '@/lib/claims-store';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: { id: string };
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = context.params;

  const session = await getSessionFromCookies();
  if (!session || !canUnderwrite(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isValidClaimId(id)) {
    return NextResponse.json({ error: 'Invalid claim ID' }, { status: 400 });
  }

  try {
    const claim = await getClaimById(id);
    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const events = await listClaimEvents(id);
    return NextResponse.json({ id, events });
  } catch (error) {
    logger.error('List claim events failed', {
      claimId: id,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'Failed to load claim history' },
      { status: 500 }
    );
  }
}
