export function isProductionDeploy(): boolean {
  return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
}

export function isBlobUploadEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_BLOB_UPLOAD === 'true';
}

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}