import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { getClaimPortalStats } from '@/lib/claims-store';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await getClaimPortalStats();
    return NextResponse.json(stats);
  } catch (error) {
    logger.error('GET /api/claims/stats failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'Failed to fetch claim stats' },
      { status: 500 }
    );
  }
}