import { NextResponse } from 'next/server';
import { canManageKnowledge, getSessionFromCookies } from '@/lib/auth';
import { getContractReference, getSupervisorOverview } from '@/lib/supervisor-stats';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session || !canManageKnowledge(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const overview = await getSupervisorOverview();
    return NextResponse.json({
      ...overview,
      contracts: getContractReference(),
    });
  } catch (error) {
    logger.error('GET /api/admin/overview failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Failed to load overview' }, { status: 500 });
  }
}