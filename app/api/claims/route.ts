import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  createClaim,
  listClaims,
  updateClaimDocuments,
} from '@/lib/claims-store';
import {
  extractFilesFromFormData,
  parseClaimFormData,
  parseClaimJson,
} from '@/lib/parse-claim-form';
import { saveUploadedFiles } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const claims = await listClaims();
    return NextResponse.json(claims);
  } catch (error) {
    console.error('GET /api/claims failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch claims' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      const parsed = parseClaimJson(body);
      const { documents, ...fields } = parsed;

      const claim = await createClaim(fields, documents);

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
      return NextResponse.json(
        { error: 'Validation failed', details: error.flatten() },
        { status: 400 }
      );
    }

    console.error('POST /api/claims failed:', error);
    return NextResponse.json(
      { error: 'Failed to submit claim' },
      { status: 500 }
    );
  }
}