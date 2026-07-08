import { runAiAnalysis } from '@/lib/claims-store';
import { logger } from '@/lib/logger';

export async function scheduleAiAnalysis(claimId: string): Promise<void> {
  const task = runAiAnalysis(claimId)
    .then((result) => {
      if (result) {
        logger.info('Background AI analysis complete', {
          claimId,
          riskScore: result.analysis.riskScore,
        });
      }
    })
    .catch((error) => {
      logger.error('Background AI analysis failed', {
        claimId,
        error: error instanceof Error ? error.message : 'unknown',
      });
    });

  if (process.env.VERCEL) {
    const { waitUntil } = await import('@vercel/functions');
    waitUntil(task);
    return;
  }

  await task;
}