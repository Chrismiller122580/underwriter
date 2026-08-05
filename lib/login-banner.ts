/**
 * One-shot post-login banner stored in sessionStorage so the next page can
 * greet the user with their role (supervisor vs reviewer).
 */

export const LOGIN_BANNER_KEY = 'fwcut-login-banner';

export type LoginBannerPayload = {
  role: 'adjuster' | 'supervisor';
  name?: string;
  email?: string;
  at: number;
};

function getSessionStorage(): Storage | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

export function writeLoginBanner(payload: LoginBannerPayload): void {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(LOGIN_BANNER_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures (private mode, quota).
  }
}

export function consumeLoginBanner(): LoginBannerPayload | null {
  const storage = getSessionStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(LOGIN_BANNER_KEY);
    if (!raw) return null;
    storage.removeItem(LOGIN_BANNER_KEY);
    const parsed = JSON.parse(raw) as LoginBannerPayload;
    if (parsed.role !== 'adjuster' && parsed.role !== 'supervisor') {
      return null;
    }
    // Discard banners older than 5 minutes (stale tabs).
    if (Date.now() - (parsed.at ?? 0) > 5 * 60 * 1000) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
