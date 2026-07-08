export type TutorialState = {
  completed: boolean;
  enabled: boolean;
};

const STORAGE_PREFIX = 'fwcut_tutorial';

function storageKey(userKey: string) {
  return `${STORAGE_PREFIX}:${userKey}`;
}

export function getTutorialUserKey(email?: string, role?: string): string | null {
  if (!email) return null;
  return `${email}:${role ?? 'staff'}`;
}

export function readTutorialState(userKey: string | null): TutorialState | null {
  if (!userKey || typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(storageKey(userKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TutorialState>;
    return {
      completed: Boolean(parsed.completed),
      enabled: Boolean(parsed.enabled),
    };
  } catch {
    return null;
  }
}

export function writeTutorialState(
  userKey: string | null,
  state: TutorialState
): void {
  if (!userKey || typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(userKey), JSON.stringify(state));
}

export function defaultTutorialState(): TutorialState {
  return { completed: false, enabled: true };
}

export function shouldAutoOpenTutorial(state: TutorialState): boolean {
  return !state.completed || state.enabled;
}

export const TUTORIAL_CHANGE_EVENT = 'fwcut-tutorial-change';

export function emitTutorialChange(state: TutorialState): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(TUTORIAL_CHANGE_EVENT, { detail: state })
  );
}