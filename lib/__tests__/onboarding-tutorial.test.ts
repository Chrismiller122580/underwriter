import { describe, expect, it } from 'vitest';
import {
  TUTORIAL_STEPS,
  defaultTutorialState,
  shouldAutoOpenTutorial,
  stepsForRole,
} from '@/lib/onboarding-tutorial';

describe('onboarding tutorial preferences', () => {
  it('auto-opens for brand-new users', () => {
    expect(shouldAutoOpenTutorial(defaultTutorialState())).toBe(true);
  });

  it('does not auto-open after completion unless re-enabled', () => {
    expect(
      shouldAutoOpenTutorial({ completed: true, enabled: false })
    ).toBe(false);
  });

  it('opens when a returning user turns the tutorial toggle on', () => {
    expect(
      shouldAutoOpenTutorial({ completed: true, enabled: true })
    ).toBe(true);
  });
});

describe('stepsForRole', () => {
  it('gives adjusters staff workflow steps without supervisor-only content', () => {
    const steps = stepsForRole('adjuster');
    const ids = steps.map((s) => s.id);

    expect(ids).toContain('welcome');
    expect(ids).toContain('ai-scan');
    expect(ids).toContain('request-info');
    expect(ids).toContain('manual-decision');
    expect(ids).toContain('intake');
    expect(ids).not.toContain('supervisor-toolbox');
    expect(ids).not.toContain('supervisor-knowledge');
    expect(ids).not.toContain('supervisor-users');
    expect(steps.every((s) => !s.roles || s.roles.includes('adjuster'))).toBe(
      true
    );
  });

  it('includes supervisor toolbox steps for supervisors', () => {
    const adjuster = stepsForRole('adjuster');
    const supervisor = stepsForRole('supervisor');
    const ids = supervisor.map((s) => s.id);

    expect(supervisor.length).toBeGreaterThan(adjuster.length);
    expect(ids).toContain('supervisor-toolbox');
    expect(ids).toContain('supervisor-knowledge');
    expect(ids).toContain('supervisor-users');
    expect(ids).toContain('intake');
  });

  it('defaults unknown roles to the adjuster catalog', () => {
    expect(stepsForRole(undefined).map((s) => s.id)).toEqual(
      stepsForRole('adjuster').map((s) => s.id)
    );
    expect(stepsForRole('other').length).toBe(stepsForRole('adjuster').length);
  });

  it('keeps a complete step catalog with unique ids', () => {
    const ids = TUTORIAL_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(TUTORIAL_STEPS.length).toBeGreaterThanOrEqual(11);
  });
});
