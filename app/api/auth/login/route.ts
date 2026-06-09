import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  SESSION_COOKIE,
  createSessionToken,
  getConfiguredRoles,
  verifyLoginPassword,
  type UserRole,
} from '@/lib/auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  password: z.string().min(1),
  role: z.enum(['adjuster', 'supervisor']).default('adjuster'),
});

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const configured = getConfiguredRoles();

    if (body.role === 'supervisor' && !configured.supervisor) {
      return NextResponse.json(
        {
          error:
            'Supervisor login is not configured. Set SUPERVISOR_PASSWORD or ADJUSTER_PASSWORD on the server.',
        },
        { status: 503 }
      );
    }

    if (body.role === 'adjuster' && !configured.adjuster) {
      return NextResponse.json(
        { error: 'Adjuster login is not configured. Set ADJUSTER_PASSWORD on the server.' },
        { status: 503 }
      );
    }

    const session = verifyLoginPassword(body.password, body.role as UserRole);

    if (!session) {
      logger.warn('Failed login attempt', { role: body.role });
      return NextResponse.json(
        {
          error:
            body.role === 'supervisor'
              ? 'Invalid supervisor password.'
              : 'Invalid adjuster password.',
        },
        { status: 401 }
      );
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