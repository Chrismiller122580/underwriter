import { NextResponse } from 'next/server';
import { z } from 'zod';
import { canUnderwrite, getSessionFromCookies } from '@/lib/auth';
import {
  isValidClaimId,
  waiveClaimDocument,
} from '@/lib/claims-store';
import { sanitizeClaimForPortal } from '@/lib/document-urls';
import {
  DOCUMENT_WAIVER_REASON_LABELS,
  isWaivableDocumentField,
  WAIVABLE_DOCUMENT_FIELDS,
} from '@/lib/document-waivers';
import { logger } from '@/lib/logger';
import { FILE_FIELD_LABELS } from '@/lib/parse-claim-form';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const bodySchema = z.object({
  field: z.enum(WAIVABLE_DOCUMENT_FIELDS),
  reason: z.enum(['none', 'not_applicable', 'unavailable']).default('none'),
  note: z.string().max(500).optional(),
});

/**
 * POST /api/claims/[id]/documents/waive
 * Mark a document slot as none / N/A (currently prior claims history only).
 */
export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const session = await getSessionFromCookies();
  if (!session || !canUnderwrite(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isValidClaimId(id)) {
    return NextResponse.json({ error: 'Invalid claim ID' }, { status: 400 });
  }

  try {
    const body = bodySchema.parse(await request.json());
    if (!isWaivableDocumentField(body.field)) {
      return NextResponse.json(
        { error: 'This document field cannot be waived' },
        { status: 400 }
      );
    }

    const claim = await waiveClaimDocument(id, body.field, {
      reason: body.reason,
      note:
        body.note ??
        (body.reason === 'none'
          ? 'Attested no prior claims history on file'
          : undefined),
      attestedBy: session.email,
    });

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const label = FILE_FIELD_LABELS[body.field];
    logger.info('Claim document waived', {
      claimId: id,
      field: body.field,
      reason: body.reason,
      role: session.role,
    });

    const sanitized = sanitizeClaimForPortal(claim);

    return NextResponse.json({
      id: claim._id,
      claimDetails: sanitized.claimDetails,
      field: body.field,
      message: `${label} marked ${DOCUMENT_WAIVER_REASON_LABELS[body.reason].toLowerCase()}`,
      updatedAt: claim.updatedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error:
            'Invalid request — provide a waivable field (priorClaimsHistory) and reason',
          details: error.flatten(),
        },
        { status: 400 }
      );
    }
    if (
      error instanceof Error &&
      (error.message.includes('cannot be waived') ||
        error.message.includes('already has uploaded'))
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    logger.error('POST claim document waive failed', {
      claimId: id,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'Failed to waive document slot' },
      { status: 500 }
    );
  }
}
