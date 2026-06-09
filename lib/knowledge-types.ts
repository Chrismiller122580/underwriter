export const KNOWLEDGE_CATEGORIES = [
  'guidelines',
  'procedure',
  'contract',
  'denial_rules',
  'reference',
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export const KNOWLEDGE_CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  guidelines: 'Underwriting Guidelines',
  procedure: 'Claims Procedure',
  contract: 'Contract / Plan Document',
  denial_rules: 'Denial Rules & Triggers',
  reference: 'Reference Material',
};

export type KnowledgeDocument = {
  id: string;
  title: string;
  category: KnowledgeCategory;
  filename: string;
  contentType: string;
  fileUrl: string;
  extractedText: string;
  notes: string | null;
  active: boolean;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
};

export const KNOWLEDGE_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const KNOWLEDGE_MAX_TEXT_PER_DOC = 24_000;
export const KNOWLEDGE_MAX_TOTAL_CONTEXT = 80_000;

export const KNOWLEDGE_ALLOWED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/html',
  'application/json',
] as const;