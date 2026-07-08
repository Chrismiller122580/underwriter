import { readFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { getClaimById, isValidClaimId } from '@/lib/claims-store';
import { isAllowedClaimDocumentUrl } from '@/lib/document-urls';
import { logger } from '@/lib/logger';
import { FILE_FIELD_LABELS, FILE_FIELDS } from '@/lib/parse-claim-form';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: { id: string; field: string };
};

function contentTypeForField(field: string, fallback?: string | null) {
  if (fallback) return fallback;
  if (field.includes('Records') || field.includes('History')) {
    return 'application/pdf';
  }
  return 'application/octet-stream';
}

export async function GET(_request: Request, context: RouteContext) {
  const { id, field } = context.params;

  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isValidClaimId(id)) {
    return NextResponse.json({ error: 'Invalid claim ID' }, { status: 400 });
  }

  if (!FILE_FIELDS.includes(field as (typeof FILE_FIELDS)[number])) {
    return NextResponse.json({ error: 'Invalid document field' }, { status: 400 });
  }

  try {
    const claim = await getClaimById(id);
    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const rawUrl = claim.claimDetails.attachedDocuments?.[field];
    if (!rawUrl) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (!isAllowedClaimDocumentUrl(rawUrl)) {
      return NextResponse.json({ error: 'Document access denied' }, { status: 403 });
    }

    if (rawUrl.startsWith('uploads/')) {
      const diskPath = path.join(process.cwd(), rawUrl);
      const buffer = await readFile(diskPath);

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': contentTypeForField(field),
          'Content-Disposition': `inline; filename="${field}"`,
        },
      });
    }

    const upstream = await fetch(rawUrl);
    if (!upstream.ok) {
      logger.error('Failed to fetch claim document blob', {
        claimId: id,
        field,
        status: upstream.status,
      });
      return NextResponse.json(
        { error: 'Failed to retrieve document' },
        { status: 502 }
      );
    }

    const label = FILE_FIELD_LABELS[field as (typeof FILE_FIELDS)[number]] ?? field;

    return new NextResponse(upstream.body, {
      headers: {
        'Content-Type': contentTypeForField(
          field,
          upstream.headers.get('content-type')
        ),
        'Content-Disposition': `inline; filename="${label}"`,
      },
    });
  } catch (error) {
    logger.error('GET claim document failed', {
      claimId: id,
      field,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'Failed to retrieve document' },
      { status: 500 }
    );
  }
}