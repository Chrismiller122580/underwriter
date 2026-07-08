import { NextResponse } from 'next/server';
import { canUnderwrite, getSessionFromCookies } from '@/lib/auth';
import { isValidClaimId, runAiAnalysis } from '@/lib/claims-store';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: { id: string };
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = context.params;
  const force = new URL(request.url).searchParams.get('force') === 'true';

  const session = await getSessionFromCookies();
  if (!session || !canUnderwrite(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isValidClaimId(id)) {
    return NextResponse.json({ error: 'Invalid claim ID' }, { status: 400 });
  }

  try {
    const outcome = await runAiAnalysis(id, { force });
    if (!outcome) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    logger.info('AI analysis completed', {
      claimId: id,
      riskScore: outcome.analysis.riskScore,
      recommendation: outcome.analysis.recommendation,
      model: outcome.analysis.model,
    });

    return NextResponse.json({
      id: outcome.claim._id,
      aiAnalysis: outcome.analysis,
      reused: outcome.reused,
    });
  } catch (error) {
    logger.error('AI analysis failed', {
      claimId: id,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'AI analysis failed' },
      { status: 500 }
    );
  }
}