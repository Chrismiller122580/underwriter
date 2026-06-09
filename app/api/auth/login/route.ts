import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  SESSION_COOKIE,
  createSessionToken,
  verifyAdjusterPassword,
} from '@/lib/auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const session = verifyAdjusterPassword(body.password);

    if (!session) {
      logger.warn('Failed login attempt');
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await createSessionToken(session);
    const response = NextResponse.json({
      email: session.email,
      role: session.role,
    });

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8,
    });

    logger.info('Adjuster logged in', { role: session.role });
    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}