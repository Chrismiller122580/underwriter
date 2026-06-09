import { runAiAnalysis } from '@/lib/claims-store';
import { logger } from '@/lib/logger';

export function scheduleAiAnalysis(claimId: string): void {
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
    import('@vercel/functions').then(({ waitUntil }) => waitUntil(task));
  }
}