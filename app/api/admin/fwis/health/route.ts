import { NextResponse } from 'next/server';
import { canManageKnowledge, getSessionFromCookies } from '@/lib/auth';
import { checkFwisConnection, getFwisConfig } from '@/lib/fwis';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Supervisor-only: probe FWIS connectivity with the configured API key.
 * Safe to call before Freedom finalizes path names — reports 401/404/timeouts clearly.
 */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session || !canManageKnowledge(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const cfg = getFwisConfig();
    const status = await checkFwisConnection();

    logger.info('FWIS health check', {
      configured: status.configured,
      reachable: status.reachable,
      httpStatus: status.httpStatus,
      pathTried: status.pathTried,
    });

    return NextResponse.json({
      ...status,
      paths: cfg.paths,
      // Never echo the raw API key
      hasApiKey: Boolean(cfg.apiKey),
    });
  } catch (error) {
    logger.error('FWIS health check failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'FWIS health check failed' },
      { status: 500 }
    );
  }
}
