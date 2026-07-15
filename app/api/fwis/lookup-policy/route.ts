import { NextResponse } from 'next/server';
import { z } from 'zod';
import { canUnderwrite, getSessionFromCookies } from '@/lib/auth';
import { lookupPolicy } from '@/lib/policy-lookup';
import { fetchFwisPolicy, getFwisConfig, isFwisConfigured } from '@/lib/fwis';
import { logger } from '@/lib/logger';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  policyNumber: z.string().min(1),
});

/**
 * Staff policy lookup that prefers live FWIS data when configured,
 * then falls back to local prefix/contract rules.
 */
export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session || !canUnderwrite(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(`fwis-lookup:${ip}`, 30, 60 * 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many lookups' }, { status: 429 });
  }

  try {
    const body = bodySchema.parse(await request.json());
    const local = lookupPolicy(body.policyNumber);

    if (!isFwisConfigured() || !getFwisConfig().enabled) {
      return NextResponse.json({
        source: 'local',
        fwis: null,
        ...local,
      });
    }

    const fwis = await fetchFwisPolicy(body.policyNumber);

    if (!fwis.ok) {
      logger.warn('FWIS policy lookup failed, using local', {
        policyNumber: body.policyNumber,
        error: fwis.error,
        status: fwis.status,
      });
      return NextResponse.json({
        source: 'local',
        fwisError: fwis.error,
        fwisStatus: fwis.status,
        ...local,
      });
    }

    const p = fwis.data;
    return NextResponse.json({
      source: 'fwis',
      valid: local.valid || Boolean(p.policyNumber),
      contractType:
        local.contractType !== 'unknown'
          ? local.contractType
          : (p.contractType as typeof local.contractType) ?? 'unknown',
      variant: local.variant,
      contractVariant: p.contractVariant ?? local.variant,
      displayName: local.displayName,
      prefix: local.prefix,
      accountId: local.accountId,
      confidence: Math.max(local.confidence, p.policyNumber ? 0.9 : 0),
      source: 'fwis' as const,
      coverageDetails:
        p.coverageDetails ?? local.coverageDetails ?? undefined,
      vehicle: {
        vin: p.vin ?? undefined,
        make: p.make ?? undefined,
        model: p.model ?? undefined,
        year: p.year ?? undefined,
        odometerReading: undefined,
        odometerAtEffective: p.odometerAtEffective ?? undefined,
      },
      policyEffectiveDate: p.effectiveDate ?? undefined,
      policyExpirationDate: p.expirationDate ?? undefined,
      fwisStatus: p.status ?? undefined,
      fwis: {
        policyNumber: p.policyNumber,
        status: p.status,
        effectiveDate: p.effectiveDate,
        expirationDate: p.expirationDate,
        vin: p.vin,
        make: p.make,
        model: p.model,
        year: p.year,
      },
      local,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'policyNumber is required' }, { status: 400 });
    }
    logger.error('FWIS lookup-policy failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}
