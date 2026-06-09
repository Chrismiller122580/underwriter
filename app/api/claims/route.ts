import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  createClaim,
  listClaims,
  updateClaimDocuments,
} from '@/lib/claims-store';
import { getSessionFromCookies } from '@/lib/auth';
import { logger } from '@/lib/logger';
import {
  extractFilesFromFormData,
  parseClaimFormData,
  parseClaimJson,
} from '@/lib/parse-claim-form';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { scheduleAiAnalysis } from '@/lib/schedule-ai';
import { saveUploadedFiles } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const claims = await listClaims();
    logger.info('Claims listed', { role: session.role, count: claims.length });
    return NextResponse.json(claims);
  } catch (error) {
    logger.error('GET /api/claims failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'Failed to fetch claims' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(`submit:${ip}`, 10, 60 * 60 * 1000);

  if (!rateLimit.allowed) {
    logger.warn('Rate limit exceeded', { ip });
    return NextResponse.json(
      { error: 'Too many submissions. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(
            Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
          ),
        },
      }
    );
  }

  try {
    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      const parsed = parseClaimJson(body);
      const { documents, ...fields } = parsed;

      const claim = await createClaim(fields, documents);
      scheduleAiAnalysis(claim._id);
      logger.info('Claim submitted via JSON', { claimId: claim._id, ip });

      return NextResponse.json(
        {
          id: claim._id,
          status: claim.status,
          message: 'Claim submitted successfully.',
        },
        { status: 201 }
      );
    }

    const formData = await request.formData();
    const parsed = parseClaimFormData(formData);
    const files = extractFilesFromFormData(formData);

    const claim = await createClaim(parsed, {});

    if (Object.keys(files).length > 0) {
      const savedPaths = await saveUploadedFiles(files, claim._id);
      await updateClaimDocuments(claim._id, savedPaths);
    }

    scheduleAiAnalysis(claim._id);
    logger.info('Claim submitted via form', { claimId: claim._id, ip });

    return NextResponse.json(
      {
        id: claim._id,
        status: claim.status,
        message: 'Claim submitted successfully.',
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn('Claim validation failed', { ip });
      return NextResponse.json(
        { error: 'Validation failed', details: error.flatten() },
        { status: 400 }
      );
    }

    logger.error('POST /api/claims failed', {
      ip,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'Failed to submit claim' },
      { status: 500 }
    );
  }
}