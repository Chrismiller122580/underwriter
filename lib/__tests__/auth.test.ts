import { afterEach, describe, expect, it, vi } from 'vitest';
import { getConfiguredRoles } from '@/lib/auth';
import {
  formatRoleLabel,
  isReviewerRole,
  normalizeUserRole,
} from '@/lib/roles';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getConfiguredRoles', () => {
  it('requires a distinct supervisor password in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ADJUSTER_PASSWORD', 'adjuster-secret');
    // Ensure production is not triggered via VERCEL alone and supervisor is unset
    delete process.env.VERCEL;
    delete process.env.SUPERVISOR_PASSWORD;

    const roles = getConfiguredRoles();
    expect(roles.adjuster).toBe(true);
    expect(roles.supervisor).toBe(false);
    expect(roles.supervisorUsesAdjusterFallback).toBe(false);
  });

  it('allows adjuster password fallback for supervisor in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('ADJUSTER_PASSWORD', 'shared-secret');
    delete process.env.VERCEL;
    delete process.env.SUPERVISOR_PASSWORD;

    const roles = getConfiguredRoles();
    expect(roles.supervisor).toBe(true);
    expect(roles.supervisorUsesAdjusterFallback).toBe(true);
  });
});

describe('reviewer / adjuster role alias', () => {
  it('treats reviewer as the same role as adjuster', () => {
    expect(normalizeUserRole('reviewer')).toBe('adjuster');
    expect(normalizeUserRole('adjuster')).toBe('adjuster');
    expect(isReviewerRole('reviewer')).toBe(true);
    expect(isReviewerRole('adjuster')).toBe(true);
    expect(isReviewerRole('supervisor')).toBe(false);
    expect(formatRoleLabel('adjuster')).toBe('Reviewer');
    expect(formatRoleLabel('reviewer')).toBe('Reviewer');
    expect(formatRoleLabel('supervisor')).toBe('Supervisor');
  });
});
