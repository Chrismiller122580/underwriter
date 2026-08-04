/**
 * Staff role helpers safe for client and server components.
 * Keep free of next/headers and other server-only imports.
 */

export type UserRole = 'adjuster' | 'supervisor';

/**
 * Stored role keys. `adjuster` is the underwriting / claim-review staff role
 * (product label: "Reviewer"). Supervisors get Admin Tools.
 */
/** UI labels — adjuster and reviewer are the same role. */
export const ROLE_LABELS: Record<UserRole, string> = {
  adjuster: 'Reviewer',
  supervisor: 'Supervisor',
};

/**
 * Normalize user/input role names. "reviewer" is an alias for adjuster.
 */
export function normalizeUserRole(
  role: string | undefined | null
): UserRole | null {
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

/** True for the underwriting staff role (adjuster / reviewer). */
export function isReviewerRole(
  role: UserRole | string | undefined | null
): boolean {
  return normalizeUserRole(role) === 'adjuster';
}
