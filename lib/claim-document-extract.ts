import { readFile } from 'fs/promises';
import path from 'path';
import type { ClaimRecord } from '@/lib/claims-store';
import { isAllowedClaimDocumentUrl } from '@/lib/document-urls';
import { logger } from '@/lib/logger';
import { FILE_FIELD_LABELS, FILE_FIELDS } from '@/lib/parse-claim-form';

export const DOC_TEXT_MAX_PER_FILE = 4_000;
export const DOC_TEXT_MAX_TOTAL = 14_000;

export type ExtractedClaimDocument = {
  field: (typeof FILE_FIELDS)[number];
  label: string;
  source: string;
  text: string;
  truncated: boolean;
  error?: string;
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text: string, max: number): { text: string; truncated: boolean } {
  const trimmed = text.trim();
  if (trimmed.length <= max) return { text: trimmed, truncated: false };
  return {
    text: `${trimmed.slice(0, max)}\n\n[Truncated for AI context]`,
    truncated: true,
  };
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text ?? '';
}

async function bufferToText(
  buffer: Buffer,
  contentType: string,
  filename: string
): Promise<string> {
  const lowerName = filename.toLowerCase();
  const type = contentType.toLowerCase();

  if (type === 'application/pdf' || lowerName.endsWith('.pdf')) {
    return extractPdfText(buffer);
  }

  if (
    type.startsWith('text/') ||
    type === 'application/json' ||
    lowerName.endsWith('.txt') ||
    lowerName.endsWith('.md') ||
    lowerName.endsWith('.html') ||
    lowerName.endsWith('.htm') ||
    lowerName.endsWith('.json') ||
    lowerName.endsWith('.csv')
  ) {
    const raw = buffer.toString('utf8');
    if (
      type === 'text/html' ||
      lowerName.endsWith('.html') ||
      lowerName.endsWith('.htm')
    ) {
      return stripHtml(raw);
    }
    return raw;
  }

  // Images / unknown binaries: no OCR in this path
  throw new Error(
    `Unsupported document type for text extract (${contentType || filename})`
  );
}

async function loadDocumentBuffer(
  source: string
): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  if (source.startsWith('uploads/')) {
    if (!isAllowedClaimDocumentUrl(source)) {
      throw new Error('Local document path is not allowed');
    }
    const abs = path.join(process.cwd(), source);
    // Prevent path traversal outside uploads/
    const uploadsRoot = path.join(process.cwd(), 'uploads');
    if (!abs.startsWith(uploadsRoot + path.sep) && abs !== uploadsRoot) {
      throw new Error('Document path escapes uploads directory');
    }
    const buffer = await readFile(abs);
    const filename = path.basename(abs);
    const contentType = filename.toLowerCase().endsWith('.pdf')
      ? 'application/pdf'
      : 'application/octet-stream';
    return { buffer, contentType, filename };
  }

  if (!isAllowedClaimDocumentUrl(source)) {
    throw new Error('Document URL is not from an allowed upload source');
  }

  const response = await fetch(source, {
    headers: { Accept: 'application/pdf,text/*,*/*' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch document (${response.status})`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  const urlPath = new URL(source).pathname;
  const filename = path.basename(urlPath) || 'document';
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType,
    filename,
  };
}

/**
 * Extract text from claim supporting documents for AI underwriting context.
 * Failures are recorded per-file; overall extraction never throws.
 */
export async function extractClaimDocumentTexts(
  claim: ClaimRecord
): Promise<ExtractedClaimDocument[]> {
  const attached = claim.claimDetails.attachedDocuments ?? {};
  const results: ExtractedClaimDocument[] = [];
  let totalChars = 0;

  for (const field of FILE_FIELDS) {
    const source = attached[field];
    if (!source) continue;

    if (totalChars >= DOC_TEXT_MAX_TOTAL) {
      results.push({
        field,
        label: FILE_FIELD_LABELS[field],
        source,
        text: '',
        truncated: true,
        error: 'Skipped — total document context budget reached',
      });
      continue;
    }

    const remaining = Math.min(
      DOC_TEXT_MAX_PER_FILE,
      DOC_TEXT_MAX_TOTAL - totalChars
    );

    try {
      const { buffer, contentType, filename } = await loadDocumentBuffer(source);
      const raw = await bufferToText(buffer, contentType, filename);
      const { text, truncated } = truncate(raw, remaining);
      totalChars += text.length;
      results.push({
        field,
        label: FILE_FIELD_LABELS[field],
        source,
        text,
        truncated,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'extract failed';
      logger.warn('Claim document extract failed', {
        claimId: claim._id,
        field,
        error: message,
      });
      results.push({
        field,
        label: FILE_FIELD_LABELS[field],
        source,
        text: '',
        truncated: false,
        error: message,
      });
    }
  }

  return results;
}

export function formatDocumentTextsForPrompt(
  docs: ExtractedClaimDocument[]
): Array<{
  field: string;
  label: string;
  extracted: boolean;
  truncated?: boolean;
  error?: string;
  textPreview?: string;
}> {
  return docs.map((doc) => ({
    field: doc.field,
    label: doc.label,
    extracted: Boolean(doc.text) && !doc.error,
    truncated: doc.truncated || undefined,
    error: doc.error,
    textPreview: doc.text
      ? doc.text.slice(0, DOC_TEXT_MAX_PER_FILE)
      : undefined,
  }));
}
