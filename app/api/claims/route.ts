import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  createClaim,
  listClaims,
  updateClaimDocuments,
} from '@/lib/claims-store';
import { canUnderwrite, getSessionFromCookies } from '@/lib/auth';
import { sanitizeClaimForPortal } from '@/lib/document-urls';
import { logger } from '@/lib/logger';
import {
  extractFilesFromFormData,
  parseClaimFormData,
  parseClaimJson,
  validateUploadedFileSizes,
} from '@/lib/parse-claim-form';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { scheduleAiAnalysis } from '@/lib/schedule-ai';
import { saveUploadedFiles } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') ?? '50');
    const cursor = searchParams.get('cursor') ?? undefined;

    const result = await listClaims({
      limit: Number.isFinite(limit) ? limit : 50,
      cursor,
    });

    logger.info('Claims listed', {
      role: session.role,
      count: result.claims.length,
      hasMore: Boolean(result.nextCursor),
    });

    return NextResponse.json({
      claims: result.claims.map(sanitizeClaimForPortal),
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid pagination cursor') {
      return NextResponse.json({ error: 'Invalid pagination cursor' }, { status: 400 });
    }

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
  const session = await getSessionFromCookies();
  if (!session || !canUnderwrite(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
      await scheduleAiAnalysis(claim._id);
      logger.info('Claim submitted via JSON', { claimId: claim._id, ip });

      return NextResponse.json(
        {
          id: claim._id,
          status: claim.status,
          trackingCode: claim.publicToken,
          message:
            'Claim submitted successfully. Share the tracking code with the claimant for status checks.',
        },
        { status: 201 }
      );
    }

    const formData = await request.formData();
    const parsed = parseClaimFormData(formData);
    const files = extractFilesFromFormData(formData);
    validateUploadedFileSizes(files);

    const claim = await createClaim(parsed, {});

    if (Object.keys(files).length > 0) {
      const savedPaths = await saveUploadedFiles(files, claim._id);
      await updateClaimDocuments(claim._id, savedPaths);
    }

    await scheduleAiAnalysis(claim._id);
    logger.info('Claim submitted via form', { claimId: claim._id, ip });

    return NextResponse.json(
      {
        id: claim._id,
        status: claim.status,
        trackingCode: claim.publicToken,
        message:
          'Claim submitted successfully. Share the tracking code with the claimant for status checks.',
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('exceeds the 10 MB limit')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

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