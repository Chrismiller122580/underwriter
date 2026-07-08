import { put } from '@vercel/blob';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

async function saveToLocalDisk(
  files: Record<string, File>,
  claimId: string
): Promise<Record<string, string>> {
  const claimDir = path.join(UPLOAD_ROOT, claimId);
  await mkdir(claimDir, { recursive: true });

  const entries = Object.entries(files).filter(
    ([, file]) => file && file.size > 0
  );

  const results = await Promise.all(
    entries.map(async ([field, file]) => {
      const safeName = file!.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `${field}-${safeName}`;
      const diskPath = path.join(claimDir, filename);
      const buffer = Buffer.from(await file!.arrayBuffer());

      await writeFile(diskPath, buffer);
      return [field, `uploads/${claimId}/${filename}`] as const;
    })
  );

  return Object.fromEntries(results);
}

async function saveToVercelBlob(
  files: Record<string, File>,
  claimId: string
): Promise<Record<string, string>> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for blob uploads');
  }

  const entries = Object.entries(files).filter(
    ([, file]) => file && file.size > 0
  );

  const results = await Promise.all(
    entries.map(async ([field, file]) => {
      const safeName = file!.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const pathname = `claims/${claimId}/${field}-${safeName}`;

      const blob = await put(pathname, file!, {
        access: 'public',
        token,
      });

      return [field, blob.url] as const;
    })
  );

  return Object.fromEntries(results);
}

export async function saveUploadedFiles(
  files: Record<string, File>,
  claimId: string
): Promise<Record<string, string>> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return saveToVercelBlob(files, claimId);
  }

  return saveToLocalDisk(files, claimId);
}

