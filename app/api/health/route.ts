import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'fwcut-underwriter',
    phase: 5,
  });
}