import {
  KNOWLEDGE_MAX_TEXT_PER_DOC,
  type KnowledgeCategory,
} from '@/lib/knowledge-types';

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

function truncateText(text: string, max = KNOWLEDGE_MAX_TEXT_PER_DOC): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}\n\n[Truncated for AI context length]`;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text ?? '';
}

export async function extractKnowledgeText(
  buffer: Buffer,
  contentType: string,
  filename: string
): Promise<string> {
  const lowerName = filename.toLowerCase();

  if (contentType === 'application/pdf' || lowerName.endsWith('.pdf')) {
    return truncateText(await extractPdfText(buffer));
  }

  if (
    contentType.startsWith('text/') ||
    lowerName.endsWith('.txt') ||
    lowerName.endsWith('.md') ||
    lowerName.endsWith('.html') ||
    lowerName.endsWith('.htm') ||
    lowerName.endsWith('.json')
  ) {
    const raw = buffer.toString('utf8');
    const text =
      contentType === 'text/html' ||
      lowerName.endsWith('.html') ||
      lowerName.endsWith('.htm')
        ? stripHtml(raw)
        : raw;
    return truncateText(text);
  }

  throw new Error(
    'Unsupported file type. Upload PDF, TXT, MD, HTML, or JSON.'
  );
}

export function categoryPriority(category: KnowledgeCategory): number {
  switch (category) {
    case 'guidelines':
      return 0;
    case 'procedure':
      return 1;
    case 'denial_rules':
      return 2;
    case 'contract':
      return 3;
    default:
      return 4;
  }
}