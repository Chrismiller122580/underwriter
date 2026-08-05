import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_QUEUE_PREFS,
  QUEUE_PREFS_KEY,
  readQueuePreferences,
  writeQueuePreferences,
} from '@/lib/queue-preferences';

function mockLocalStorage() {
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
  vi.stubGlobal('localStorage', api);
  return api;
}

describe('queue preferences', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns defaults when empty', () => {
    expect(readQueuePreferences()).toEqual(DEFAULT_QUEUE_PREFS);
  });

  it('persists filter and sort choices', () => {
    writeQueuePreferences({
      statusFilter: 'high_risk',
      contractFilter: 'vital',
      sortBy: 'amount',
    });

    expect(readQueuePreferences()).toEqual({
      statusFilter: 'high_risk',
      contractFilter: 'vital',
      sortBy: 'amount',
    });
    expect(localStorage.getItem(QUEUE_PREFS_KEY)).toContain('high_risk');
  });

  it('falls back on invalid stored status', () => {
    localStorage.setItem(
      QUEUE_PREFS_KEY,
      JSON.stringify({ statusFilter: 'bogus', sortBy: 'priority' })
    );
    const prefs = readQueuePreferences();
    expect(prefs.statusFilter).toBe(DEFAULT_QUEUE_PREFS.statusFilter);
    expect(prefs.sortBy).toBe('priority');
  });
});
