'use client';

import { useRef, useState } from 'react';
import type { ExtractableField } from '@/lib/extract-claim';

type ExtractResponse = {
  fields: Partial<Record<ExtractableField, string>>;
  fieldsFound: string[];
  filledCount: number;
  missingFields: string[];
  notes?: string;
};

type ScreenshotAutofillProps = {
  onExtracted: (
    fields: Partial<Record<ExtractableField, string>>,
    meta: { fieldsFound: string[]; notes?: string }
  ) => void;
  disabled?: boolean;
};

export function ScreenshotAutofill({
  onExtracted,
  disabled,
}: ScreenshotAutofillProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setMessage(null);

    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));

    try {
      const formData = new FormData();
      formData.append('screenshot', file);

      const response = await fetch('/api/claims/extract', {
        method: 'POST',
        body: formData,
      });

      const data = (await response.json()) as ExtractResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? 'Extraction failed');
      }

      onExtracted(data.fields, {
        fieldsFound: data.fieldsFound,
        notes: data.notes,
      });

      const baseText = `Autofilled ${data.filledCount} fields from your portal screenshot. Review and complete any missing fields below.`;
      setMessage({
        type: data.notes ? 'info' : 'success',
        text: data.notes ? `${baseText} Note: ${data.notes}` : baseText,
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Extraction failed',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="form-section screenshot-autofill">
      <h2>Portal Screenshot Autofill</h2>
      <p className="form-hint">
        Upload a screenshot from your claims portal and AI will extract visible
        fields to autofill the form. PNG, JPEG, or WebP — max 5 MB.
      </p>

      <div className="screenshot-upload-row">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="screenshot-input"
          disabled={disabled || loading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <button
          type="button"
          className="button"
          disabled={disabled || loading}
          onClick={() => inputRef.current?.click()}
        >
          {loading ? 'Extracting with AI…' : 'Upload Portal Screenshot'}
        </button>
      </div>

      {preview && (
        <div className="screenshot-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Portal screenshot preview" />
        </div>
      )}

      {message && (
        <p
          className={
            message.type === 'error'
              ? 'form-error'
              : message.type === 'success'
                ? 'form-success'
                : 'form-hint'
          }
        >
          {message.text}
        </p>
      )}
    </section>
  );
}