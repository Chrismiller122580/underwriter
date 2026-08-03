import { NextResponse } from 'next/server';
import { canManageKnowledge, getSessionFromCookies } from '@/lib/auth';
import {
  deleteKnowledgeDocument,
  setKnowledgeDocumentActive,
} from '@/lib/knowledge-store';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session || !canManageKnowledge(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const body = (await request.json()) as { active?: boolean };
    if (typeof body.active !== 'boolean') {
      return NextResponse.json({ error: 'active boolean is required.' }, { status: 400 });
    }

    const document = await setKnowledgeDocumentActive(id, body.active);
    if (!document) {
      return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    }

    return NextResponse.json({ document });
  } catch (error) {
    logger.error('PATCH /api/admin/knowledge/[id] failed', {
      id,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session || !canManageKnowledge(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const deleted = await deleteKnowledgeDocument(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    }

    logger.info('Knowledge document deleted', {
      id,
      deletedBy: session.email,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('DELETE /api/admin/knowledge/[id] failed', {
      id,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}