import { readFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { documentUrls } from '@/lib/claim-documents';
import { getClaimById, isValidClaimId } from '@/lib/claims-store';
import { isAllowedClaimDocumentUrl } from '@/lib/document-urls';
import { logger } from '@/lib/logger';
import { FILE_FIELD_LABELS, FILE_FIELDS } from '@/lib/parse-claim-form';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string; field: string }>;
};

function contentTypeForField(field: string, fallback?: string | null) {
  if (fallback) return fallback;
  if (field.includes('Records') || field.includes('History')) {
    return 'application/pdf';
  }
  return 'application/octet-stream';
}

export async function GET(request: Request, context: RouteContext) {
  const { id, field } = await context.params;

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

  const indexParam = new URL(request.url).searchParams.get('index');
  const index = indexParam != null ? Number(indexParam) : 0;
  if (!Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: 'Invalid document index' }, { status: 400 });
  }

  try {
    const claim = await getClaimById(id);
    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const urls = documentUrls(claim.claimDetails.attachedDocuments?.[field]);
    const rawUrl = urls[index];
    if (!rawUrl) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (!isAllowedClaimDocumentUrl(rawUrl)) {
      return NextResponse.json({ error: 'Document access denied' }, { status: 403 });
    }

    const labelBase =
      FILE_FIELD_LABELS[field as (typeof FILE_FIELDS)[number]] ?? field;
    const label =
      urls.length > 1 ? `${labelBase}-${index + 1}` : labelBase;

    if (rawUrl.startsWith('uploads/')) {
      const diskPath = path.join(/* turbopackIgnore: true */ process.cwd(), rawUrl);
      const buffer = await readFile(diskPath);

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': contentTypeForField(field),
          'Content-Disposition': `inline; filename="${label}"`,
        },
      });
    }

    const upstream = await fetch(rawUrl);
    if (!upstream.ok) {
      logger.error('Failed to fetch claim document blob', {
        claimId: id,
        field,
        index,
        status: upstream.status,
      });
      return NextResponse.json(
        { error: 'Failed to retrieve document' },
        { status: 502 }
      );
    }

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
