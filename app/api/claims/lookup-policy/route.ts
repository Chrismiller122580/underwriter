import { NextResponse } from 'next/server';
import { z } from 'zod';
import { lookupPolicy } from '@/lib/policy-lookup';
import { logger } from '@/lib/logger';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  policyNumber: z.string().min(1),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(`lookup:${ip}`, 30, 60 * 60 * 1000);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many lookup requests. Please try again later.' },
      { status: 429 }
    );
  }

  try {
    const body = bodySchema.parse(await request.json());
    const result = lookupPolicy(body.policyNumber);

    logger.info('Policy lookup', {
      ip,
      valid: result.valid,
      contractType: result.contractType,
      prefix: result.prefix,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Policy number is required.' }, { status: 400 });
    }

    logger.error('Policy lookup failed', {
      ip,
      error: error instanceof Error ? error.message : 'unknown',
    });

    return NextResponse.json({ error: 'Policy lookup failed' }, { status: 500 });
  }
}