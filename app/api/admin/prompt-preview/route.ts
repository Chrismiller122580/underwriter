import { NextResponse } from 'next/server';
import { canManageKnowledge, getSessionFromCookies } from '@/lib/auth';
import { buildUnderwritingSystemPrompt } from '@/lib/knowledge-prompt';
import { CONTRACT_TYPES } from '@/lib/contracts/types';
import type { ContractTypeOrUnknown, ContractVariant } from '@/lib/contracts/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session || !canManageKnowledge(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const contractType = (searchParams.get('contractType') ?? 'vital') as ContractTypeOrUnknown;
  const variant = (searchParams.get('variant') ?? 'standard') as ContractVariant;

  const validType =
    contractType === 'unknown' ||
    (CONTRACT_TYPES as readonly string[]).includes(contractType)
      ? contractType
      : 'vital';

  const prompt = await buildUnderwritingSystemPrompt(validType, variant);

  return NextResponse.json({
    contractType: validType,
    variant,
    charCount: prompt.length,
    prompt,
  });
}