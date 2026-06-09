import { NextResponse } from 'next/server';
import { canManageKnowledge, getSessionFromCookies } from '@/lib/auth';
import { seedBundledKnowledge } from '@/lib/knowledge-seed';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  const session = await getSessionFromCookies();
  if (!session || !canManageKnowledge(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const result = await seedBundledKnowledge(session.email);
    logger.info('Knowledge seed completed', {
      uploadedBy: session.email,
      seeded: result.seeded.length,
      skipped: result.skipped.length,
      failed: result.failed.length,
    });
    return NextResponse.json(result);
  } catch (error) {
    logger.error('POST /api/admin/seed-knowledge failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Failed to seed knowledge base' }, { status: 500 });
  }
}