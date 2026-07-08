import { describe, expect, it } from 'vitest';
import {
  defaultTutorialState,
  shouldAutoOpenTutorial,
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