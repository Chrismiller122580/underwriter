'use client';

import { useEffect, useRef, useState } from 'react';
import type { ExtractableField } from '@/lib/extract-claim';

type ScreenshotItem = {
  id: string;
  file: File;
  preview: string;
};

type ExtractResponse = {
  fields: Partial<Record<ExtractableField, string>>;
  fieldsFound: string[];
  filledCount: number;
  missingFields: string[];
  screenshotCount: number;
  notes?: string;
};

type ScreenshotAutofillProps = {
  onExtracted: (
    fields: Partial<Record<ExtractableField, string>>,
    meta: { fieldsFound: string[]; notes?: string }
  ) => void;
  disabled?: boolean;
};

const MAX_SCREENSHOTS = 10;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export function ScreenshotAutofill({
  onExtracted,
  disabled,
}: ScreenshotAutofillProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => {
      for (const url of Array.from(urls)) {
        URL.revokeObjectURL(url);
      }
      urls.clear();
    };
  }, []);

  function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files);
    if (incoming.length === 0) return;

    setMessage(null);
    const errors: string[] = [];
    const accepted: ScreenshotItem[] = [];

    for (const file of incoming) {
      if (screenshots.length + accepted.length >= MAX_SCREENSHOTS) {
        errors.push(`Maximum ${MAX_SCREENSHOTS} screenshots allowed.`);
        break;
      }

      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        errors.push(`${file.name} must be PNG, JPEG, or WebP.`);
        continue;
      }

      if (file.size > MAX_FILE_BYTES) {
        errors.push(`${file.name} must be 5 MB or smaller.`);
        continue;
      }

      const preview = URL.createObjectURL(file);
      previewUrlsRef.current.add(preview);
      accepted.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        preview,
      });
    }

    if (accepted.length > 0) {
      setScreenshots((prev) => [...prev, ...accepted]);
    }

    if (errors.length > 0) {
      setMessage({ type: 'error', text: errors.join(' ') });
    }

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  function removeScreenshot(id: string) {
    setScreenshots((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.preview);
        previewUrlsRef.current.delete(target.preview);
      }
      return prev.filter((item) => item.id !== id);
    });
  }

  async function handleExtract() {
    if (screenshots.length === 0) return;

    setLoading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      for (const item of screenshots) {
        formData.append('screenshots', item.file);
      }

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

      const countLabel =
        data.screenshotCount === 1 ? 'screenshot' : `${data.screenshotCount} screenshots`;
      const baseText = `Autofilled ${data.filledCount} fields from your ${countLabel}. Review and complete any missing fields below.`;
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
        Upload one or more screenshots from your claims portal and AI will extract
        visible fields to autofill the form. PNG, JPEG, or WebP — max 5 MB each, up
        to {MAX_SCREENSHOTS} images.
      </p>

      <div className="screenshot-upload-row">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="screenshot-input"
          disabled={disabled || loading}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
          }}
        />
        <button
          type="button"
          className="button"
          disabled={disabled || loading || screenshots.length >= MAX_SCREENSHOTS}
          onClick={() => inputRef.current?.click()}
        >
          Add Screenshots
        </button>
        <button
          type="button"
          className="button"
          disabled={disabled || loading || screenshots.length === 0}
          onClick={handleExtract}
        >
          {loading
            ? `Extracting from ${screenshots.length} screenshot${screenshots.length === 1 ? '' : 's'}…`
            : screenshots.length === 0
              ? 'Extract from Screenshots'
              : `Extract from ${screenshots.length} Screenshot${screenshots.length === 1 ? '' : 's'}`}
        </button>
      </div>

      {screenshots.length > 0 && (
        <div className="screenshot-preview-grid">
          {screenshots.map((item) => (
            <div key={item.id} className="screenshot-preview-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.preview} alt={item.file.name} />
              <div className="screenshot-preview-meta">
                <span className="screenshot-preview-name" title={item.file.name}>
                  {item.file.name}
                </span>
                <button
                  type="button"
                  className="link-button"
                  disabled={disabled || loading}
                  onClick={() => removeScreenshot(item.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
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