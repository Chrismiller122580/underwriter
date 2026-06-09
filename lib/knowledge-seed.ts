import { readFile } from 'fs/promises';
import path from 'path';
import { extractKnowledgeText } from '@/lib/knowledge-extract';
import {
  createKnowledgeFromBuffer,
  findKnowledgeByTitle,
} from '@/lib/knowledge-store';
import type { KnowledgeCategory } from '@/lib/knowledge-types';

type SeedAsset = {
  relativePath: string;
  title: string;
  category: KnowledgeCategory;
  contentType: string;
  notes?: string;
};

const BUNDLED_ASSETS: SeedAsset[] = [
  {
    relativePath: 'Claims Underwriting Process.pdf',
    title: 'Claims Underwriting Process',
    category: 'guidelines',
    contentType: 'application/pdf',
    notes: 'Primary Freedom Warranty claims underwriting procedure.',
  },
  {
    relativePath: 'contracts/classic.html',
    title: 'Freedom Classic Plan Registration',
    category: 'contract',
    contentType: 'text/html',
  },
  {
    relativePath: 'contracts/vital.html',
    title: 'Freedom Vital Plan Registration',
    category: 'contract',
    contentType: 'text/html',
    notes: 'Stated-component contract. Vital is stated coverage, not exclusionary.',
  },
  {
    relativePath: 'contracts/drive.html',
    title: 'Freedom Drive Plan Registration',
    category: 'contract',
    contentType: 'text/html',
  },
  {
    relativePath: 'contracts/complete.html',
    title: 'Freedom Complete Plan Registration',
    category: 'contract',
    contentType: 'text/html',
    notes: 'Exclusionary contract — deny if component is in Section 2 exclusions.',
  },
];

export async function seedBundledKnowledge(uploadedBy: string): Promise<{
  seeded: string[];
  skipped: string[];
  failed: { title: string; error: string }[];
}> {
  const seeded: string[] = [];
  const skipped: string[] = [];
  const failed: { title: string; error: string }[] = [];

  for (const asset of BUNDLED_ASSETS) {
    const existing = await findKnowledgeByTitle(asset.title);
    if (existing) {
      skipped.push(asset.title);
      continue;
    }

    try {
      const absolutePath = path.join(process.cwd(), asset.relativePath);
      const buffer = await readFile(absolutePath);
      const extractedText = await extractKnowledgeText(
        buffer,
        asset.contentType,
        path.basename(asset.relativePath)
      );

      await createKnowledgeFromBuffer({
        title: asset.title,
        category: asset.category,
        filename: path.basename(asset.relativePath),
        contentType: asset.contentType,
        buffer,
        extractedText,
        notes: asset.notes,
        uploadedBy,
      });

      seeded.push(asset.title);
    } catch (error) {
      failed.push({
        title: asset.title,
        error: error instanceof Error ? error.message : 'unknown error',
      });
    }
  }

  return { seeded, skipped, failed };
}