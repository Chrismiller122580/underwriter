import { afterEach, describe, expect, it } from 'vitest';
import { getConfiguredRoles } from '@/lib/auth';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('getConfiguredRoles', () => {
  it('requires a distinct supervisor password in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.VERCEL;
    process.env.ADJUSTER_PASSWORD = 'adjuster-secret';
    delete process.env.SUPERVISOR_PASSWORD;

    const roles = getConfiguredRoles();
    expect(roles.adjuster).toBe(true);
    expect(roles.supervisor).toBe(false);
    expect(roles.supervisorUsesAdjusterFallback).toBe(false);
  });

  it('allows adjuster password fallback for supervisor in development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.VERCEL;
    process.env.ADJUSTER_PASSWORD = 'shared-secret';
    delete process.env.SUPERVISOR_PASSWORD;

    const roles = getConfiguredRoles();
    expect(roles.supervisor).toBe(true);
    expect(roles.supervisorUsesAdjusterFallback).toBe(true);
  });
});