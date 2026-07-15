import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  SESSION_COOKIE,
  createSessionToken,
  getConfiguredRoles,
  verifyLoginPassword,
  type Session,
  type UserRole,
} from '@/lib/auth';
import { isProductionDeploy } from '@/lib/env';
import { logger } from '@/lib/logger';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { authenticateUser } from '@/lib/users-store';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().email().optional().or(z.literal('')),
  password: z.string().min(1),
  /** Used only for shared env-password fallback when no matching user. */
  role: z.enum(['adjuster', 'supervisor']).default('adjuster'),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000);

  if (!rateLimit.allowed) {
    logger.warn('Login rate limit exceeded', { ip });
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(
            Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
          ),
        },
      }
    );
  }

  try {
    const body = loginSchema.parse(await request.json());
    const password = body.password.trim();
    const email = body.email?.trim().toLowerCase() ?? '';

    let session: Session | null = null;

    // 1) Named multi-user accounts
    if (email) {
      try {
        const user = await authenticateUser(email, password);
        if (user) {
          session = {
            email: user.email,
            role: user.role,
            userId: user.id,
            name: user.name,
          };
        }
      } catch (error) {
        logger.warn('User DB auth failed, trying env password fallback', {
          error: error instanceof Error ? error.message : 'unknown',
        });
      }
    }

    // 2) Legacy shared passwords (bootstrap / emergency)
    if (!session) {
      const configured = getConfiguredRoles();
      const role = body.role as UserRole;

      if (role === 'supervisor' && !configured.supervisor) {
        return NextResponse.json(
          {
            error: isProductionDeploy()
              ? 'Supervisor login requires SUPERVISOR_PASSWORD or a supervisor user account.'
              : 'Supervisor login is not configured. Set SUPERVISOR_PASSWORD or seed users.',
          },
          { status: 503 }
        );
      }

      if (role === 'adjuster' && !configured.adjuster && !email) {
        return NextResponse.json(
          {
            error:
              'Adjuster login is not configured. Set ADJUSTER_PASSWORD or create a user account.',
          },
          { status: 503 }
        );
      }

      const legacy = verifyLoginPassword(password, role);
      if (legacy) {
        session = {
          ...legacy,
          email: email || legacy.email,
        };
      }
    }

    if (!session) {
      logger.warn('Failed login attempt', {
        role: body.role,
        hasEmail: Boolean(email),
      });
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const token = await createSessionToken(session);
    const response = NextResponse.json({
      email: session.email,
      role: session.role,
      name: session.name,
      userId: session.userId,
    });

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8,
    });

    logger.info('Staff logged in', {
      role: session.role,
      email: session.email,
      multiUser: Boolean(session.userId),
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
