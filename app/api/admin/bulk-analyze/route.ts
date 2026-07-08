import { NextResponse } from 'next/server';
import { z } from 'zod';
import { canManageKnowledge, getSessionFromCookies } from '@/lib/auth';
import { listClaimsForScope, runAiAnalysis } from '@/lib/claims-store';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  scope: z.enum(['pending', 'under_review', 'unanalyzed', 'all']).default('unanalyzed'),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session || !canManageKnowledge(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const targets = await listClaimsForScope(body.scope, body.limit);
    const results: {
      claimId: string;
      ok: boolean;
      riskScore?: number;
      recommendation?: string;
      error?: string;
    }[] = [];

    for (const claim of targets) {
      try {
        const result = await runAiAnalysis(claim._id);
        if (!result) {
          results.push({ claimId: claim._id, ok: false, error: 'Claim not found' });
          continue;
        }
        results.push({
          claimId: claim._id,
          ok: true,
          riskScore: result.analysis.riskScore,
          recommendation: result.analysis.recommendation,
        });
      } catch (error) {
        results.push({
          claimId: claim._id,
          ok: false,
          error: error instanceof Error ? error.message : 'unknown',
        });
      }
    }

    logger.info('Bulk AI analysis complete', {
      scope: body.scope,
      processed: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
      supervisor: session.email,
    });

    return NextResponse.json({
      scope: body.scope,
      matched: targets.length,
      processed: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
      results,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    logger.error('POST /api/admin/bulk-analyze failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Bulk analysis failed' }, { status: 500 });
  }
}