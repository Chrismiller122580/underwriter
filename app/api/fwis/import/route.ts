import { NextResponse } from 'next/server';
import { z } from 'zod';
import { canUnderwrite, getSessionFromCookies } from '@/lib/auth';
import {
  getFwisConfig,
  importClaimFromFwis,
  isFwisConfigured,
} from '@/lib/fwis';
import { logger } from '@/lib/logger';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  /** Contract / policy number (e.g. FWVL041518) */
  contractNumber: z.string().min(1),
  /** FWIS claim number */
  claimNumber: z.string().min(1),
});

/**
 * Primary intake: pull contract + claim from FWIS and return form fields.
 * Replaces screenshot autofill when the API key is configured.
 */
export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session || !canUnderwrite(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(`fwis-import:${ip}`, 40, 60 * 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many import attempts' }, { status: 429 });
  }

  if (!isFwisConfigured() || !getFwisConfig().enabled) {
    return NextResponse.json(
      {
        error:
          'FWIS is not configured. Set FWIS_API_KEY to import claims from Freedom Warranty.',
        configured: false,
      },
      { status: 503 }
    );
  }

  try {
    const body = bodySchema.parse(await request.json());
    const { bundle, form } = await importClaimFromFwis(
      body.contractNumber,
      body.claimNumber
    );

    if (!form || !bundle.loaded) {
      logger.warn('FWIS import returned no data', {
        contractNumber: body.contractNumber,
        claimNumber: body.claimNumber,
        errors: bundle.errors,
      });
      return NextResponse.json(
        {
          error:
            'No claim/contract data returned from FWIS. Check numbers, API paths (FWIS_PATH_*), and auth style.',
          bundle,
          form: null,
        },
        { status: 404 }
      );
    }

    logger.info('FWIS claim imported for intake', {
      contractNumber: body.contractNumber,
      claimNumber: body.claimNumber,
      fieldsFound: form.fieldsFound.length,
      fwisClaimId: form.fwisClaimId,
      role: session.role,
    });

    return NextResponse.json({
      source: 'fwis',
      supersedesScreenshot: true,
      bundle: {
        contractNumber: bundle.contractNumber,
        claimNumber: bundle.claimNumber,
        loaded: bundle.loaded,
        errors: bundle.errors,
        hasPolicy: Boolean(bundle.policy),
        hasClaim: Boolean(bundle.claim),
        fwisClaimId: form.fwisClaimId,
        fwisStatus: bundle.claim?.status ?? bundle.policy?.status ?? null,
      },
      form: {
        fields: form.fields,
        fieldsFound: form.fieldsFound,
        contractType: form.contractType,
        contractVariant: form.contractVariant,
        fwisClaimId: form.fwisClaimId,
        fwisContractNumber: form.fwisContractNumber,
        fwisClaimNumber: form.fwisClaimNumber,
        warnings: form.warnings,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'contractNumber and claimNumber are required' },
        { status: 400 }
      );
    }
    logger.error('FWIS import failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'FWIS import failed' }, { status: 500 });
  }
}
