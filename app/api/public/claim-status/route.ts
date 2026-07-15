import { NextResponse } from 'next/server';
import { z } from 'zod';
import { findClaimByPublicToken } from '@/lib/claims-store';
import { logger } from '@/lib/logger';
import {
  matchesLastName,
  toPublicClaimStatus,
} from '@/lib/public-status';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  trackingCode: z.string().min(6).max(32),
  lastName: z.string().min(1).max(120),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(`status:${ip}`, 20, 60 * 60 * 1000);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many status lookups. Please try again later.' },
      { status: 429 }
    );
  }

  try {
    const body = bodySchema.parse(await request.json());
    const claim = await findClaimByPublicToken(body.trackingCode);

    // Uniform response timing-ish: always same shape on failure
    if (!claim || !matchesLastName(claim.claimantInformation.name, body.lastName)) {
      logger.info('Public status lookup miss', { ip });
      return NextResponse.json(
        {
          error:
            'No claim found for that tracking code and last name. Check your confirmation details.',
        },
        { status: 404 }
      );
    }

    logger.info('Public status lookup hit', {
      claimId: claim._id,
      status: claim.status,
    });

    return NextResponse.json({ claim: toPublicClaimStatus(claim) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Provide a tracking code and last name.' },
        { status: 400 }
      );
    }
    logger.error('Public status lookup failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'Unable to look up claim status right now.' },
      { status: 500 }
    );
  }
}
