/**
 * Persist reviewer queue filters/sort in localStorage.
 */

import type { ClaimFilter, ContractFilter } from '@/lib/claim-portal';

export const QUEUE_PREFS_KEY = 'fwcut-queue-prefs';

export type QueuePreferences = {
  statusFilter: ClaimFilter;
  contractFilter: ContractFilter;
  sortBy: 'priority' | 'newest' | 'risk' | 'amount';
};

const VALID_STATUS: ClaimFilter[] = [
  'all',
  'action_needed',
  'needs_info',
  'guideline_flags',
  'high_risk',
  'under_review',
  'no_ai',
];

const VALID_SORT: QueuePreferences['sortBy'][] = [
  'priority',
  'newest',
  'risk',
  'amount',
];

export const DEFAULT_QUEUE_PREFS: QueuePreferences = {
  statusFilter: 'action_needed',
  contractFilter: 'all',
  sortBy: 'priority',
};

function getLocalStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function readQueuePreferences(): QueuePreferences {
  const storage = getLocalStorage();
  if (!storage) return DEFAULT_QUEUE_PREFS;
  try {
    const raw = storage.getItem(QUEUE_PREFS_KEY);
    if (!raw) return DEFAULT_QUEUE_PREFS;
    const parsed = JSON.parse(raw) as Partial<QueuePreferences>;
    return {
      statusFilter: VALID_STATUS.includes(parsed.statusFilter as ClaimFilter)
        ? (parsed.statusFilter as ClaimFilter)
        : DEFAULT_QUEUE_PREFS.statusFilter,
      contractFilter:
        typeof parsed.contractFilter === 'string' && parsed.contractFilter
          ? (parsed.contractFilter as ContractFilter)
          : DEFAULT_QUEUE_PREFS.contractFilter,
      sortBy: VALID_SORT.includes(parsed.sortBy as QueuePreferences['sortBy'])
        ? (parsed.sortBy as QueuePreferences['sortBy'])
        : DEFAULT_QUEUE_PREFS.sortBy,
    };
  } catch {
    return DEFAULT_QUEUE_PREFS;
  }
}

export function writeQueuePreferences(prefs: QueuePreferences): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(QUEUE_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage failures.
  }
}
