/**
 * Staff can skip (acknowledge/dismiss) AI guideline concerns so claims
 * can proceed when the adjuster has accepted the risk or verified offline.
 */

export type GuidelineSkip = {
  /** Exact (or normalized) guideline conflict text that was skipped. */
  conflict: string;
  note?: string;
  skippedAt: string;
  skippedBy?: string;
};

export function normalizeGuidelineText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isGuidelineSkipped(
  skips: GuidelineSkip[] | undefined | null,
  conflict: string
): boolean {
  if (!skips?.length) return false;
  const target = normalizeGuidelineText(conflict);
  return skips.some((skip) => normalizeGuidelineText(skip.conflict) === target);
}

export function getActiveGuidelineConflicts(
  conflicts: string[] | undefined | null,
  skips: GuidelineSkip[] | undefined | null
): string[] {
  if (!conflicts?.length) return [];
  return conflicts.filter((conflict) => !isGuidelineSkipped(skips, conflict));
}

export function getSkippedGuidelineConflicts(
  conflicts: string[] | undefined | null,
  skips: GuidelineSkip[] | undefined | null
): Array<{ conflict: string; skip: GuidelineSkip }> {
  if (!conflicts?.length || !skips?.length) return [];
  const out: Array<{ conflict: string; skip: GuidelineSkip }> = [];
  for (const conflict of conflicts) {
    const skip = skips.find(
      (entry) =>
        normalizeGuidelineText(entry.conflict) ===
        normalizeGuidelineText(conflict)
    );
    if (skip) out.push({ conflict, skip });
  }
  return out;
}

export function buildGuidelineSkip(
  conflict: string,
  options?: { note?: string; skippedBy?: string; skippedAt?: string }
): GuidelineSkip {
  return {
    conflict: conflict.trim(),
    ...(options?.note?.trim()
      ? { note: options.note.trim().slice(0, 500) }
      : {}),
    skippedAt: options?.skippedAt ?? new Date().toISOString(),
    ...(options?.skippedBy ? { skippedBy: options.skippedBy } : {}),
  };
}

/** Merge a new skip into the list (dedupe by normalized conflict text). */
export function mergeGuidelineSkip(
  existing: GuidelineSkip[] | undefined | null,
  next: GuidelineSkip
): GuidelineSkip[] {
  const base = existing ?? [];
  const target = normalizeGuidelineText(next.conflict);
  const without = base.filter(
    (skip) => normalizeGuidelineText(skip.conflict) !== target
  );
  return [...without, next];
}

/** True when the conflict is about missing maintenance / service records. */
export function isMaintenanceGuidelineConflict(conflict: string): boolean {
  const text = normalizeGuidelineText(conflict);
  return (
    text.includes('maintenance') ||
    text.includes('service history') ||
    text.includes('service record') ||
    text.includes('verifiable maintenance')
  );
}
