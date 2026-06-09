import { put } from '@vercel/blob';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { ensureSchema, getSql } from '@/lib/db';
import { categoryPriority } from '@/lib/knowledge-extract';
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_MAX_TOTAL_CONTEXT,
  type KnowledgeCategory,
  type KnowledgeDocument,
} from '@/lib/knowledge-types';

type KnowledgeRow = {
  id: string;
  title: string;
  category: KnowledgeCategory;
  filename: string;
  content_type: string;
  file_url: string;
  extracted_text: string;
  notes: string | null;
  active: boolean;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
};

function mapRow(row: KnowledgeRow): KnowledgeDocument {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    filename: row.filename,
    contentType: row.content_type,
    fileUrl: row.file_url,
    extractedText: row.extracted_text,
    notes: row.notes,
    active: row.active,
    uploadedBy: row.uploaded_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function saveKnowledgeFile(
  file: File,
  documentId: string
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (token) {
    const blob = await put(`knowledge/${documentId}/${safeName}`, file, {
      access: 'public',
      token,
    });
    return blob.url;
  }

  const dir = path.join(process.cwd(), 'uploads', 'knowledge', documentId);
  await mkdir(dir, { recursive: true });
  const diskPath = path.join(dir, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(diskPath, buffer);
  return `uploads/knowledge/${documentId}/${safeName}`;
}

export async function listKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
  await ensureKnowledgeSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM underwriting_knowledge
    ORDER BY created_at DESC
  `) as KnowledgeRow[];

  return rows.map(mapRow);
}

export async function listActiveKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
  await ensureKnowledgeSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM underwriting_knowledge
    WHERE active = true
    ORDER BY created_at DESC
  `) as KnowledgeRow[];

  return rows
    .map(mapRow)
    .sort(
      (a, b) =>
        categoryPriority(a.category) - categoryPriority(b.category) ||
        b.createdAt.localeCompare(a.createdAt)
    );
}

export async function createKnowledgeDocument(input: {
  title: string;
  category: KnowledgeCategory;
  filename: string;
  contentType: string;
  file: File;
  extractedText: string;
  notes?: string;
  uploadedBy: string;
}): Promise<KnowledgeDocument> {
  await ensureKnowledgeSchema();
  const sql = getSql();

  const placeholderRows = (await sql`
    INSERT INTO underwriting_knowledge (
      title, category, filename, content_type, file_url,
      extracted_text, notes, uploaded_by
    ) VALUES (
      ${input.title},
      ${input.category},
      ${input.filename},
      ${input.contentType},
      'pending',
      ${input.extractedText},
      ${input.notes ?? null},
      ${input.uploadedBy}
    )
    RETURNING *
  `) as KnowledgeRow[];

  const created = placeholderRows[0];
  const fileUrl = await saveKnowledgeFile(input.file, created.id);

  const rows = (await sql`
    UPDATE underwriting_knowledge
    SET file_url = ${fileUrl},
        updated_at = NOW()
    WHERE id = ${created.id}::uuid
    RETURNING *
  `) as KnowledgeRow[];

  return mapRow(rows[0]);
}

export async function setKnowledgeDocumentActive(
  id: string,
  active: boolean
): Promise<KnowledgeDocument | null> {
  await ensureKnowledgeSchema();
  const sql = getSql();

  const rows = (await sql`
    UPDATE underwriting_knowledge
    SET active = ${active},
        updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING *
  `) as KnowledgeRow[];

  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}

export async function deleteKnowledgeDocument(id: string): Promise<boolean> {
  await ensureKnowledgeSchema();
  const sql = getSql();

  const rows = (await sql`
    DELETE FROM underwriting_knowledge
    WHERE id = ${id}::uuid
    RETURNING id
  `) as { id: string }[];

  return rows.length > 0;
}

export async function buildKnowledgeContext(): Promise<string> {
  const docs = await listActiveKnowledgeDocuments();
  if (docs.length === 0) return '';

  const sections: string[] = [];
  let totalChars = 0;

  for (const doc of docs) {
    const body = [doc.extractedText, doc.notes].filter(Boolean).join('\n\n');
    if (!body.trim()) continue;

    const header = `### ${doc.title} (${doc.category})`;
    const section = `${header}\n${body}`;
    if (totalChars + section.length > KNOWLEDGE_MAX_TOTAL_CONTEXT) break;

    sections.push(section);
    totalChars += section.length;
  }

  if (sections.length === 0) return '';

  return [
    'SUPERVISOR-UPLOADED UNDERWRITING KNOWLEDGE (apply alongside base guidelines):',
    ...sections,
  ].join('\n\n');
}

let knowledgeSchemaReady = false;

export async function ensureKnowledgeSchema(): Promise<void> {
  await ensureSchema();
  if (knowledgeSchemaReady) return;

  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS underwriting_knowledge (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      category VARCHAR(50) NOT NULL DEFAULT 'reference',
      filename VARCHAR(255) NOT NULL,
      content_type VARCHAR(100) NOT NULL,
      file_url TEXT NOT NULL,
      extracted_text TEXT NOT NULL DEFAULT '',
      notes TEXT,
      active BOOLEAN NOT NULL DEFAULT true,
      uploaded_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_knowledge_active
    ON underwriting_knowledge(active, created_at DESC)
  `;

  knowledgeSchemaReady = true;
}

export function isKnowledgeCategory(value: string): value is KnowledgeCategory {
  return (KNOWLEDGE_CATEGORIES as readonly string[]).includes(value);
}