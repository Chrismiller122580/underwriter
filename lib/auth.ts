import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { isProductionDeploy } from '@/lib/env';

export const SESSION_COOKIE = 'fwcut_session';
export type UserRole = 'adjuster' | 'supervisor';

export type Session = {
  email: string;
  role: UserRole;
};

const userRoleSchema = z.enum(['adjuster', 'supervisor']);

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET must be set and at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT({ email: session.email, role: session.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string
): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.email || !payload.role) return null;

    const roleResult = userRoleSchema.safeParse(payload.role);
    if (!roleResult.success) return null;

    return {
      email: String(payload.email),
      role: roleResult.data,
    };
  } catch {
    return null;
  }
}

export async function getSessionFromCookies(): Promise<Session | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getSessionFromRequest(
  request: NextRequest
): Promise<Session | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function getConfiguredRoles(): {
  adjuster: boolean;
  supervisor: boolean;
  supervisorUsesAdjusterFallback: boolean;
} {
  const adjusterPassword = process.env.ADJUSTER_PASSWORD?.trim();
  const supervisorPassword = process.env.SUPERVISOR_PASSWORD?.trim();
  const supervisorConfigured = isProductionDeploy()
    ? Boolean(supervisorPassword)
    : Boolean(supervisorPassword || adjusterPassword);

  return {
    adjuster: Boolean(adjusterPassword),
    supervisor: supervisorConfigured,
    supervisorUsesAdjusterFallback:
      !isProductionDeploy() && !supervisorPassword && Boolean(adjusterPassword),
  };
}

export function verifyLoginPassword(
  password: string,
  role: UserRole
): Session | null {
  const input = password.trim();
  const adjusterPassword = process.env.ADJUSTER_PASSWORD?.trim();
  const supervisorPassword = process.env.SUPERVISOR_PASSWORD?.trim();

  if (role === 'supervisor') {
    const effectiveSupervisorPassword = isProductionDeploy()
      ? supervisorPassword
      : supervisorPassword || adjusterPassword;

    if (effectiveSupervisorPassword && input === effectiveSupervisorPassword) {
      return { email: 'supervisor@fwcut.local', role: 'supervisor' };
    }
    return null;
  }

  if (adjusterPassword && input === adjusterPassword) {
    return { email: 'adjuster@fwcut.local', role: 'adjuster' };
  }

  return null;
}

/** @deprecated Use verifyLoginPassword with an explicit role. */
export function verifyAdjusterPassword(password: string): Session | null {
  const input = password.trim();
  const adjusterPassword = process.env.ADJUSTER_PASSWORD?.trim();
  const supervisorPassword = process.env.SUPERVISOR_PASSWORD?.trim();

  if (supervisorPassword && input === supervisorPassword) {
    return { email: 'supervisor@fwcut.local', role: 'supervisor' };
  }

  if (adjusterPassword && input === adjusterPassword) {
    return { email: 'adjuster@fwcut.local', role: 'adjuster' };
  }

  return null;
}

export function canUnderwrite(role: UserRole): boolean {
  return role === 'adjuster' || role === 'supervisor';
}

export function canManageKnowledge(role: UserRole): boolean {
  return role === 'supervisor';
}