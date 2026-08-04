'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  apiFetch,
  isUnauthorized,
  loginPath,
} from '@/lib/client-api';
import type { ClaimRecord } from '@/lib/claims-store';
import {
  FILE_FIELD_LABELS,
  FILE_FIELDS,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/parse-claim-form';
import { FileInput } from './FileInput';

export type AttachDocumentsResult = {
  claimDetails: ClaimRecord['claimDetails'];
  attachedFields: string[];
  updatedAt?: string;
  message?: string;
};

type MissingDoc = {
  field: (typeof FILE_FIELDS)[number];
  label: string;
};

export function AttachDocuments({
  claimId,
  missingDocs,
  onComplete,
}: {
  claimId: string;
  missingDocs: MissingDoc[];
  onComplete?: (result: AttachDocumentsResult) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (missingDocs.length === 0) {
    return null;
  }

  const selectedCount = missingDocs.filter((doc) => files[doc.field]).length;

  async function handleUpload() {
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    let anyFile = false;

    for (const doc of missingDocs) {
      const file = files[doc.field];
      if (!file) continue;
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(`${doc.label} must be 10 MB or smaller.`);
        return;
      }
      formData.append(doc.field, file);
      anyFile = true;
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

  return (
    <div className="attach-docs-control">
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

      {success && !open && <p className="form-success attach-docs-msg">{success}</p>}

      {open && (
        <div className="attach-docs-panel">
          <p className="form-hint">
            Attach files the claimant or shop provided after submission. Each
            file must be 10 MB or smaller.
          </p>
          <div className="form-grid attach-docs-grid">
            {missingDocs.map((doc) => (
              <FileInput
                key={doc.field}
                id={`${claimId}-${doc.field}`}
                name={doc.field}
                label={doc.label}
                onChange={(file) =>
                  setFiles((prev) => ({ ...prev, [doc.field]: file }))
                }
              />
            ))}
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
export function allDocumentSlots(): MissingDoc[] {
  return FILE_FIELDS.map((field) => ({
    field,
    label: FILE_FIELD_LABELS[field],
  }));
}
