import { put } from '@vercel/blob';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import {
  compactDocumentValue,
  type AttachedDocumentValue,
} from '@/lib/claim-documents';
import { flattenUploadedFiles } from '@/lib/parse-claim-form';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

async function saveToLocalDisk(
  files: Record<string, File | File[]>,
  claimId: string
): Promise<Record<string, AttachedDocumentValue>> {
  const claimDir = path.join(UPLOAD_ROOT, claimId);
  await mkdir(claimDir, { recursive: true });

  const flat = flattenUploadedFiles(files);
  const byField = new Map<string, string[]>();

  await Promise.all(
    flat.map(async ({ field, file }, index) => {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `${field}-${index}-${safeName}`;
      const diskPath = path.join(claimDir, filename);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(diskPath, buffer);
      const url = `uploads/${claimId}/${filename}`;
      const list = byField.get(field) ?? [];
      list.push(url);
      byField.set(field, list);
    })
  );

  return Object.fromEntries(
    Array.from(byField.entries()).map(([field, urls]) => [
      field,
      compactDocumentValue(urls)!,
    ])
  );
}

async function saveToVercelBlob(
  files: Record<string, File | File[]>,
  claimId: string
): Promise<Record<string, AttachedDocumentValue>> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for blob uploads');
  }

  const flat = flattenUploadedFiles(files);
  const byField = new Map<string, string[]>();

  await Promise.all(
    flat.map(async ({ field, file }, index) => {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const pathname = `claims/${claimId}/${field}-${index}-${safeName}`;
      const blob = await put(pathname, file, {
        access: 'public',
        token,
      });
      const list = byField.get(field) ?? [];
      list.push(blob.url);
      byField.set(field, list);
    })
  );

  return Object.fromEntries(
    Array.from(byField.entries()).map(([field, urls]) => [
      field,
      compactDocumentValue(urls)!,
    ])
  );
}

export async function saveUploadedFiles(
  files: Record<string, File | File[]>,
  claimId: string
): Promise<Record<string, AttachedDocumentValue>> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return saveToVercelBlob(files, claimId);
  }

  return saveToLocalDisk(files, claimId);
}
