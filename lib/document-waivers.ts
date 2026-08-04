import {
  hasAttachedDocument,
  type AttachedDocumentsMap,
} from '@/lib/claim-documents';
import {
  FILE_FIELD_LABELS,
  FILE_FIELDS,
  type FileField,
} from '@/lib/parse-claim-form';

/** Slots that staff/claimants may mark as none / not applicable. */
export const WAIVABLE_DOCUMENT_FIELDS = ['priorClaimsHistory'] as const;

export type WaivableDocumentField = (typeof WAIVABLE_DOCUMENT_FIELDS)[number];

export type DocumentWaiverReason = 'none' | 'not_applicable' | 'unavailable';

export type DocumentWaiver = {
  reason: DocumentWaiverReason;
  note?: string;
  attestedAt: string;
  attestedBy?: string;
};

export type DocumentWaiversMap = Partial<
  Record<(typeof FILE_FIELDS)[number], DocumentWaiver>
>;

export const DOCUMENT_WAIVER_REASON_LABELS: Record<DocumentWaiverReason, string> =
  {
    none: 'None on file',
    not_applicable: 'Not applicable',
    unavailable: 'Unavailable',
  };

export function isWaivableDocumentField(
  field: string
): field is WaivableDocumentField {
  return (WAIVABLE_DOCUMENT_FIELDS as readonly string[]).includes(field);
}

export function isDocumentWaived(
  waivers: DocumentWaiversMap | undefined | null,
  field: string
): boolean {
  return Boolean(waivers?.[field as keyof DocumentWaiversMap]);
}

/** Slot is complete if a file is attached or it was waived (e.g. no prior claims). */
export function isDocumentSlotSatisfied(
  field: (typeof FILE_FIELDS)[number],
  attached: AttachedDocumentsMap | undefined | null,
  waivers: DocumentWaiversMap | undefined | null
): boolean {
  return (
    hasAttachedDocument(attached?.[field]) || isDocumentWaived(waivers, field)
  );
}

export function buildDocumentWaiver(
  reason: DocumentWaiverReason,
  options?: { note?: string; attestedBy?: string; attestedAt?: string }
): DocumentWaiver {
  return {
    reason,
    ...(options?.note?.trim() ? { note: options.note.trim().slice(0, 500) } : {}),
    attestedAt: options?.attestedAt ?? new Date().toISOString(),
    ...(options?.attestedBy ? { attestedBy: options.attestedBy } : {}),
  };
}

export function formatDocumentWaiverLabel(
  field: (typeof FILE_FIELDS)[number],
  waiver: DocumentWaiver
): string {
  const label = FILE_FIELD_LABELS[field];
  const reason =
    DOCUMENT_WAIVER_REASON_LABELS[waiver.reason] ?? waiver.reason;
  return `${label} — ${reason}`;
}

export function waiveableMissingFields(claim: {
  claimDetails: {
    attachedDocuments?: AttachedDocumentsMap;
    documentWaivers?: DocumentWaiversMap;
  };
}): FileField[] {
  const attached = claim.claimDetails.attachedDocuments ?? {};
  const waivers = claim.claimDetails.documentWaivers ?? {};
  return FILE_FIELDS.filter(
    (field) =>
      isWaivableDocumentField(field) &&
      !isDocumentSlotSatisfied(field, attached, waivers)
  );
}
