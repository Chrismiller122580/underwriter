import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  canManageUsers,
  getSessionFromCookies,
} from '@/lib/auth';
import { logger } from '@/lib/logger';
import { createUser, listUsers, setUserActive } from '@/lib/users-store';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  role: z.enum(['adjuster', 'supervisor']),
  password: z.string().min(8).max(200),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  active: z.boolean(),
});

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session || !canManageUsers(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const users = await listUsers();
    return NextResponse.json({ users });
  } catch (error) {
    logger.error('List users failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session || !canManageUsers(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = createSchema.parse(await request.json());
    const user = await createUser(body);
    logger.info('User created', {
      userId: user.id,
      email: user.email,
      role: user.role,
      by: session.email,
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid user payload (email, name, role, password ≥ 8)' },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : 'Create failed';
    if (/unique|duplicate/i.test(message)) {
      return NextResponse.json(
        { error: 'A user with that email already exists' },
        { status: 409 }
      );
    }
    logger.error('Create user failed', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getSessionFromCookies();
  if (!session || !canManageUsers(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = patchSchema.parse(await request.json());
    const user = await setUserActive(body.id, body.active);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid patch body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
