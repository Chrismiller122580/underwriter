import { NextResponse } from 'next/server';
import { canManageKnowledge, getSessionFromCookies } from '@/lib/auth';
import { extractKnowledgeText } from '@/lib/knowledge-extract';
import {
  createKnowledgeDocument,
  isKnowledgeCategory,
  listKnowledgeDocuments,
} from '@/lib/knowledge-store';
import {
  KNOWLEDGE_ALLOWED_TYPES,
  KNOWLEDGE_MAX_FILE_BYTES,
} from '@/lib/knowledge-types';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session || !canManageKnowledge(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const documents = await listKnowledgeDocuments();
    return NextResponse.json({
      documents: documents.map((doc) => ({
        ...doc,
        textPreview: doc.extractedText.slice(0, 240),
        textLength: doc.extractedText.length,
        extractedText: undefined,
      })),
    });
  } catch (error) {
    logger.error('GET /api/admin/knowledge failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'Failed to load knowledge documents' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session || !canManageKnowledge(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const title = String(formData.get('title') ?? '').trim();
    const category = String(formData.get('category') ?? 'reference').trim();
    const notes = String(formData.get('notes') ?? '').trim();
    const file = formData.get('file');

    if (!title) {
      return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
    }

    if (!isKnowledgeCategory(category)) {
      return NextResponse.json({ error: 'Invalid category.' }, { status: 400 });
    }

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'A file is required.' }, { status: 400 });
    }

    if (file.size > KNOWLEDGE_MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: 'File must be 10 MB or smaller.' },
        { status: 400 }
      );
    }

    const contentType = file.type || 'application/octet-stream';
    const allowed =
      KNOWLEDGE_ALLOWED_TYPES.includes(
        contentType as (typeof KNOWLEDGE_ALLOWED_TYPES)[number]
      ) || file.name.toLowerCase().endsWith('.pdf');

    if (!allowed) {
      return NextResponse.json(
        { error: 'Upload PDF, TXT, MD, HTML, or JSON files only.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extractedText = await extractKnowledgeText(
      buffer,
      contentType,
      file.name
    );

    const document = await createKnowledgeDocument({
      title,
      category,
      filename: file.name,
      contentType,
      file,
      extractedText,
      notes: notes || undefined,
      uploadedBy: session.email,
    });

    logger.info('Knowledge document uploaded', {
      id: document.id,
      title: document.title,
      category: document.category,
      uploadedBy: session.email,
      textLength: document.extractedText.length,
    });

    return NextResponse.json(
      {
        document: {
          ...document,
          textPreview: document.extractedText.slice(0, 240),
          textLength: document.extractedText.length,
          extractedText: undefined,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('POST /api/admin/knowledge failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to upload knowledge document',
      },
      { status: 500 }
    );
  }
}