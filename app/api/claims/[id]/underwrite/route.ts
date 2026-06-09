import { NextResponse } from 'next/server';
import {
  isValidClaimId,
  underwriteClaimById,
} from '@/lib/claims-store';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: { id: string };
};

export async function POST(_request: Request, context: RouteContext) {
  const { id } = context.params;

  if (!isValidClaimId(id)) {
    return NextResponse.json({ error: 'Invalid claim ID' }, { status: 400 });
  }

  try {
    const outcome = await underwriteClaimById(id);
    if (!outcome) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const { claim, result } = outcome;

    return NextResponse.json({
      id: claim._id,
      decision: result.decision,
      reason: result.reason,
      status: claim.status,
    });
  } catch (error) {
    console.error(`POST /api/claims/${id}/underwrite failed:`, error);
    return NextResponse.json(
      { error: 'Failed to underwrite claim' },
      { status: 500 }
    );
  }
}