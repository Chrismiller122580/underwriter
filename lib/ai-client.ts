import { createXai } from '@ai-sdk/xai';

export function getXaiApiKey(): string | undefined {
  return process.env.GROK_API_KEY ?? process.env.XAI_API_KEY;
}

export function getTextModelId(): string {
  return process.env.AI_MODEL ?? 'grok-3-mini';
}

export function getVisionModelId(): string {
  return process.env.AI_VISION_MODEL ?? process.env.AI_MODEL ?? 'grok-3';
}

export function getXaiProvider() {
  const apiKey = getXaiApiKey();
  if (!apiKey) return null;
  return createXai({ apiKey });
}

export function requireXaiProvider() {
  const provider = getXaiProvider();
  if (!provider) {
    throw new Error(
      'GROK_API_KEY is required for Grok AI features. Add it in Vercel env settings (console.x.ai).'
    );
  }
  return provider;
}