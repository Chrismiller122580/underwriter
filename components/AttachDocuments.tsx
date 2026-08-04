'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  apiFetch,
  isUnauthorized,
  loginPath,
} from '@/lib/client-api';
import type { ClaimRecord } from '@/lib/claims-store';
import {
  isWaivableDocumentField,
  type DocumentWaiversMap,
} from '@/lib/document-waivers';
import {
  FILE_FIELD_LABELS,
  FILE_FIELDS,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/parse-claim-form';
import { FileInput } from './FileInput';

export type AttachDocumentsResult = {
  claimDetails: ClaimRecord['claimDetails'];
  attachedFields?: string[];
  updatedAt?: string;
  message?: string;
};

type DocSlot = {
  field: (typeof FILE_FIELDS)[number];
  label: string;
  /** How many files already stored for this slot (if any). */
  existingCount?: number;
  /** Slot already waived (e.g. no prior claims). */
  waived?: boolean;
};

export function AttachDocuments({
  claimId,
  slots,
  /** @deprecated use slots — kept for callers that only pass missing fields */
  missingDocs,
  documentWaivers,
  onComplete,
}: {
  claimId: string;
  slots?: DocSlot[];
  missingDocs?: DocSlot[];
  documentWaivers?: DocumentWaiversMap;
  onComplete?: (result: AttachDocumentsResult) => void;
}) {
  const router = useRouter();
  const uploadSlots = useMemo(
    () => slots ?? missingDocs ?? [],
    [slots, missingDocs]
  );
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [loading, setLoading] = useState(false);
  const [waiving, setWaiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (uploadSlots.length === 0) {
    return null;
  }

  const selectedCount = Object.values(files).reduce(
    (sum, list) => sum + list.length,
    0
  );

  const priorClaimsSlot = uploadSlots.find(
    (slot) => slot.field === 'priorClaimsHistory'
  );
  const canWaivePriorClaims =
    priorClaimsSlot &&
    !priorClaimsSlot.waived &&
    (priorClaimsSlot.existingCount ?? 0) === 0 &&
    !(files.priorClaimsHistory?.length);

  async function handleUpload() {
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    let anyFile = false;

    for (const slot of uploadSlots) {
      if (slot.waived) continue;
      const list = files[slot.field] ?? [];
      for (const file of list) {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          setError(`${slot.label}: each file must be 10 MB or smaller.`);
          return;
        }
        formData.append(slot.field, file);
        anyFile = true;
      }
    }

    if (!anyFile) {
      setError('Choose at least one file to upload.');
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch<{
        claimDetails: ClaimRecord['claimDetails'];
        attachedFields: string[];
        updatedAt?: string;
        message?: string;
      }>(`/api/claims/${claimId}/documents`, {
        method: 'POST',
        body: formData,
      });

      setFiles({});
      setSuccess(data.message ?? 'Documents attached.');
      setOpen(false);
      onComplete?.({
        claimDetails: data.claimDetails,
        attachedFields: data.attachedFields,
        updatedAt: data.updatedAt,
        message: data.message,
      });
    } catch (err) {
      if (isUnauthorized(err)) {
        router.push(loginPath('/claims'));
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to attach documents');
    } finally {
      setLoading(false);
    }
  }

  async function handleWaivePriorClaims() {
    setError(null);
    setSuccess(null);
    setWaiving(true);
    try {
      const data = await apiFetch<{
        claimDetails: ClaimRecord['claimDetails'];
        message?: string;
        updatedAt?: string;
      }>(`/api/claims/${claimId}/documents/waive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field: 'priorClaimsHistory',
          reason: 'none',
          note: 'Attested no prior claims history on file',
        }),
      });

      setFiles((prev) => ({ ...prev, priorClaimsHistory: [] }));
      setSuccess(data.message ?? 'Prior claims history marked none on file.');
      onComplete?.({
        claimDetails: data.claimDetails,
        updatedAt: data.updatedAt,
        message: data.message,
      });
    } catch (err) {
      if (isUnauthorized(err)) {
        router.push(loginPath('/claims'));
        return;
      }
      setError(
        err instanceof Error ? err.message : 'Failed to mark prior claims none'
      );
    } finally {
      setWaiving(false);
    }
  }

  const waivedPrior = Boolean(
    priorClaimsSlot?.waived || documentWaivers?.priorClaimsHistory
  );

  return (
    <div className="attach-docs-control">
      <div className="attach-docs-actions">
        <button
          type="button"
          className="button button-sm button-secondary"
          onClick={() => {
            setOpen((value) => !value);
            setError(null);
            setSuccess(null);
          }}
        >
          {open ? 'Cancel upload' : 'Upload supporting documents'}
        </button>
        {canWaivePriorClaims && !open && (
          <button
            type="button"
            className="button button-sm button-ghost"
            onClick={() => void handleWaivePriorClaims()}
            disabled={waiving}
          >
            {waiving ? 'Saving…' : 'No prior claims history'}
          </button>
        )}
      </div>

      {success && !open && <p className="form-success attach-docs-msg">{success}</p>}
      {waivedPrior && !open && !success && (
        <p className="claim-panel-meta attach-docs-msg">
          Prior Claims History: none on file (opted out)
        </p>
      )}

      {open && (
        <div className="attach-docs-panel">
          <p className="form-hint">
            Select one or more files per slot (Ctrl/Cmd+click or multi-select).
            New files append to any already attached. Each file max 10 MB.
          </p>
          <div className="attach-docs-grid">
            {uploadSlots.map((slot) => {
              const selected = files[slot.field] ?? [];
              const summaryParts: string[] = [];
              if (slot.waived) {
                summaryParts.push('Marked none / N/A');
              } else if (slot.existingCount && slot.existingCount > 0) {
                summaryParts.push(`${slot.existingCount} already on claim`);
              }
              if (selected.length > 0) {
                summaryParts.push(
                  `${selected.length} selected: ${selected.map((f) => f.name).join(', ')}`
                );
              }

              return (
                <div key={slot.field} className="doc-slot-tile">
                  <FileInput
                    id={`${claimId}-${slot.field}`}
                    name={slot.field}
                    label={slot.label}
                    multiple
                    hint={
                      slot.waived
                        ? 'Waived — upload clears the waiver'
                        : 'Multiple files allowed'
                    }
                    selectedSummary={
                      summaryParts.length > 0
                        ? summaryParts.join(' · ')
                        : undefined
                    }
                    onChange={(list) =>
                      setFiles((prev) => ({ ...prev, [slot.field]: list }))
                    }
                  />
                  {isWaivableDocumentField(slot.field) &&
                    !slot.waived &&
                    (slot.existingCount ?? 0) === 0 && (
                      <label className="doc-slot-optout">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={(e) => {
                            if (e.target.checked) {
                              void handleWaivePriorClaims();
                            }
                          }}
                          disabled={waiving || selected.length > 0}
                        />
                        <span>No prior claims history (none on file)</span>
                      </label>
                    )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="button button-sm"
            onClick={() => void handleUpload()}
            disabled={loading || selectedCount === 0}
          >
            {loading
              ? 'Uploading…'
              : selectedCount === 0
                ? 'Select files to upload'
                : `Attach ${selectedCount} file${selectedCount === 1 ? '' : 's'}`}
          </button>
        </div>
      )}

      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

/** Full label list for tests / callers that need every FILE_FIELD. */
export function allDocumentSlots(): DocSlot[] {
  return FILE_FIELDS.map((field) => ({
    field,
    label: FILE_FIELD_LABELS[field],
  }));
}
