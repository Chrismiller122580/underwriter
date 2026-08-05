import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LOGIN_BANNER_KEY,
  consumeLoginBanner,
  writeLoginBanner,
} from '@/lib/login-banner';

function mockSessionStorage() {
  const store = new Map<string, string>();
  const api = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
  vi.stubGlobal('sessionStorage', api);
  return api;
}

describe('login banner storage', () => {
  beforeEach(() => {
    mockSessionStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('writes and consumes a supervisor banner once', () => {
    writeLoginBanner({
      role: 'supervisor',
      name: 'Default Supervisor',
      email: 'supervisor@fwcut.local',
      at: Date.now(),
    });

    const first = consumeLoginBanner();
    expect(first?.role).toBe('supervisor');
    expect(first?.name).toBe('Default Supervisor');
    expect(sessionStorage.getItem(LOGIN_BANNER_KEY)).toBeNull();

    expect(consumeLoginBanner()).toBeNull();
  });

  it('discards stale banners', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-05T12:00:00Z'));

    writeLoginBanner({
      role: 'adjuster',
      at: Date.now() - 10 * 60 * 1000,
    });

    expect(consumeLoginBanner()).toBeNull();
  });

  it('rejects invalid role payloads', () => {
    sessionStorage.setItem(
      LOGIN_BANNER_KEY,
      JSON.stringify({ role: 'hacker', at: Date.now() })
    );
    expect(consumeLoginBanner()).toBeNull();
  });
});
