import { NextResponse } from 'next/server';
import { z } from 'zod';
import { canUnderwrite, getSessionFromCookies } from '@/lib/auth';
import {
  attachClaimDocuments,
  getClaimById,
  isValidClaimId,
} from '@/lib/claims-store';
import { documentUrls } from '@/lib/claim-documents';
import {
  isAllowedClaimDocumentUrl,
  sanitizeClaimForPortal,
  validateClaimDocumentUrls,
} from '@/lib/document-urls';
import { logger } from '@/lib/logger';
import {
  extractFilesFromFormData,
  FILE_FIELD_LABELS,
  FILE_FIELDS,
  flattenUploadedFiles,
  validateUploadedFileSizes,
} from '@/lib/parse-claim-form';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { saveUploadedFiles } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const documentUrlOrList = z.union([
  z.string().url(),
  z.array(z.string().url()).min(1),
]);

const jsonBodySchema = z.object({
  documents: z
    .record(documentUrlOrList)
    .refine(
      (docs) => Object.keys(docs).length > 0,
      'At least one document URL is required'
    )
    .superRefine((documents, ctx) => {
      for (const [field, value] of Object.entries(documents)) {
        if (!FILE_FIELDS.includes(field as (typeof FILE_FIELDS)[number])) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unknown document field "${field}"`,
            path: [field],
          });
          continue;
        }
        const urls = Array.isArray(value) ? value : [value];
        for (const [i, url] of urls.entries()) {
          if (!isAllowedClaimDocumentUrl(url)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Document URL for "${field}" is not from an allowed upload source.`,
              path: Array.isArray(value) ? [field, i] : [field],
            });
          }
        }
      }
    }),
});

/**
 * POST /api/claims/[id]/documents
 * Attach supporting documents after claim submission (append multi-file per slot).
 * Accepts multipart form fields (proofOfOwnership, …) or JSON { documents: { field: url | url[] } }.
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

  const existing = await getClaimById(id);
  if (!existing) {
    return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
  }

  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(
    `claim-docs:${session.email}`,
    40,
    60 * 60 * 1000
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many document uploads. Please try again later.' },
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
    let documentPaths: Record<string, string | string[]> = {};
    let fileCount = 0;

    if (contentType.includes('application/json')) {
      const body = jsonBodySchema.parse(await request.json());
      documentPaths = body.documents;
      validateClaimDocumentUrls(documentPaths);
      fileCount = Object.values(documentPaths).reduce(
        (sum, value) => sum + documentUrls(value).length,
        0
      );
    } else {
      const formData = await request.formData();
      const files = extractFilesFromFormData(formData);
      const flat = flattenUploadedFiles(files);
      if (flat.length === 0) {
        return NextResponse.json(
          {
            error:
              'No files provided. Attach one or more supporting documents (proof of ownership, maintenance records, etc.).',
          },
          { status: 400 }
        );
      }
      validateUploadedFileSizes(files);
      documentPaths = await saveUploadedFiles(files, id);
      fileCount = flat.length;
    }

    const claim = await attachClaimDocuments(id, documentPaths, {
      email: session.email,
      role: session.role,
    });

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const attachedFields = Object.keys(documentPaths);
    const labels = attachedFields.map(
      (field) =>
        FILE_FIELD_LABELS[field as (typeof FILE_FIELDS)[number]] ?? field
    );

    logger.info('Claim documents attached', {
      claimId: id,
      fields: attachedFields,
      fileCount,
      role: session.role,
      ip,
    });

    const sanitized = sanitizeClaimForPortal(claim);

    return NextResponse.json({
      id: claim._id,
      claimDetails: sanitized.claimDetails,
      attachedFields,
      fileCount,
      message: `Attached ${fileCount} file${fileCount === 1 ? '' : 's'}: ${labels.join(', ')}`,
      updatedAt: claim.updatedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid document payload', details: error.flatten() },
        { status: 400 }
      );
    }
    if (
      error instanceof Error &&
      (error.message.includes('exceeds the 10 MB limit') ||
        error.message.includes('At least one document') ||
        error.message.includes('not from an allowed'))
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    logger.error('POST claim documents failed', {
      claimId: id,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'Failed to attach documents' },
      { status: 500 }
    );
  }
}
