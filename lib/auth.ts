import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { isProductionDeploy } from '@/lib/env';

export const SESSION_COOKIE = 'fwcut_session';
/**
 * Stored role keys. `adjuster` is the underwriting / claim-review staff role
 * (product label: "Reviewer"). Supervisors get Admin Tools.
 */
export type UserRole = 'adjuster' | 'supervisor';

/** UI labels — adjuster and reviewer are the same role. */
export const ROLE_LABELS: Record<UserRole, string> = {
  adjuster: 'Reviewer',
  supervisor: 'Supervisor',
};

/**
 * Normalize user/input role names. "reviewer" is an alias for adjuster.
 */
export function normalizeUserRole(role: string | undefined | null): UserRole | null {
  if (!role) return null;
  const key = role.trim().toLowerCase();
  if (key === 'adjuster' || key === 'reviewer') return 'adjuster';
  if (key === 'supervisor') return 'supervisor';
  return null;
}

export function formatRoleLabel(role: string | undefined | null): string {
  const normalized = normalizeUserRole(role);
  if (!normalized) return role?.trim() || 'Staff';
  return ROLE_LABELS[normalized];
}

export type Session = {
  email: string;
  role: UserRole;
  userId?: string;
  name?: string;
};

const userRoleSchema = z.enum(['adjuster', 'supervisor', 'reviewer']).transform(
  (value) => (value === 'reviewer' ? 'adjuster' : value) as UserRole
);

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET must be set and at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT({
    email: session.email,
    role: session.role,
    userId: session.userId,
    name: session.name,
  })
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
      userId: payload.userId ? String(payload.userId) : undefined,
      name: payload.name ? String(payload.name) : undefined,
    };
  } catch {
    return null;
  }
}

export async function getSessionFromCookies(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
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
  /** True when either env passwords or DB users can authenticate. */
  multiUserReady: boolean;
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
    multiUserReady: true,
  };
}

/**
 * Shared env-password login (legacy bootstrap). Prefer named DB users when present.
 */
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
      return {
        email: 'supervisor@fwcut.local',
        role: 'supervisor',
        name: 'Default Supervisor',
      };
    }
    return null;
  }

  if (adjusterPassword && input === adjusterPassword) {
    return {
      email: 'adjuster@fwcut.local',
      role: 'adjuster',
      name: 'Default Reviewer',
    };
  }

  return null;
}

/** @deprecated Use verifyLoginPassword with an explicit role. */
export function verifyAdjusterPassword(password: string): Session | null {
  const supervisor = verifyLoginPassword(password, 'supervisor');
  if (supervisor) return supervisor;
  return verifyLoginPassword(password, 'adjuster');
}

/** Reviewers (adjuster) and supervisors can underwrite claims. */
export function canUnderwrite(role: UserRole): boolean {
  return role === 'adjuster' || role === 'supervisor';
}

export function canManageKnowledge(role: UserRole): boolean {
  return role === 'supervisor';
}

export function canManageUsers(role: UserRole): boolean {
  return role === 'supervisor';
}

/** True for the underwriting staff role (adjuster / reviewer). */
export function isReviewerRole(role: UserRole | string | undefined | null): boolean {
  return normalizeUserRole(role) === 'adjuster';
}
