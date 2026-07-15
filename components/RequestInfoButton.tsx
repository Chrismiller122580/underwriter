'use client';

import { useMemo, useState } from 'react';
import type { InfoRequestRecord } from '@/lib/info-request';

export type RequestInfoResult = {
  status: string;
  infoRequest: InfoRequestRecord | null;
  updatedAt?: string;
};

export function RequestInfoButton({
  claimId,
  suggestedItems = [],
  existingRequest,
  onComplete,
}: {
  claimId: string;
  suggestedItems?: string[];
  existingRequest?: InfoRequestRecord | null;
  onComplete?: (result: RequestInfoResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [customItem, setCustomItem] = useState('');

  const initialSelected = useMemo(() => {
    if (existingRequest?.items?.length) return [...existingRequest.items];
    return suggestedItems.slice(0, 8);
  }, [existingRequest, suggestedItems]);

  const [selected, setSelected] = useState<string[]>(initialSelected);

  function toggleItem(item: string) {
    setSelected((current) =>
      current.includes(item)
        ? current.filter((value) => value !== item)
        : [...current, item]
    );
  }

  function addCustom() {
    const value = customItem.trim();
    if (!value) return;
    setSelected((current) =>
      current.includes(value) ? current : [...current, value]
    );
    setCustomItem('');
  }

  async function submitRequest() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/claims/${claimId}/request-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selected,
          note: note.trim() || undefined,
          source: suggestedItems.length > 0 ? 'ai_suggested' : 'manual',
        }),
      });

      if (response.status === 401) {
        window.location.href = '/login?next=/claims';
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to request info');
      }

      const data = (await response.json()) as {
        status: string;
        infoRequest: InfoRequestRecord;
        updatedAt?: string;
      };

      onComplete?.({
        status: data.status,
        infoRequest: data.infoRequest,
        updatedAt: data.updatedAt,
      });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request info');
    } finally {
      setLoading(false);
    }
  }

  async function clearRequest() {
    setClearing(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/claims/${claimId}/clear-info-request`,
        { method: 'POST' }
      );

      if (response.status === 401) {
        window.location.href = '/login?next=/claims';
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to clear info request');
      }

      const data = (await response.json()) as {
        status: string;
        infoRequest: InfoRequestRecord | null;
        updatedAt?: string;
      };

      onComplete?.({
        status: data.status,
        infoRequest: data.infoRequest,
        updatedAt: data.updatedAt,
      });
      setSelected(suggestedItems.slice(0, 8));
      setNote('');
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to clear info request'
      );
    } finally {
      setClearing(false);
    }
  }

  const hasOpenRequest = Boolean(existingRequest?.items?.length);

  return (
    <div className="request-info-control">
      <div className="request-info-actions">
        <button
          type="button"
          className="button button-sm button-secondary"
          onClick={() => {
            setSelected(initialSelected);
            setOpen((value) => !value);
            setError(null);
          }}
        >
          {open
            ? 'Cancel'
            : hasOpenRequest
              ? 'Edit info request'
              : 'Request info'}
        </button>
        {hasOpenRequest && !open && (
          <button
            type="button"
            className="button button-sm button-ghost"
            onClick={clearRequest}
            disabled={clearing}
          >
            {clearing ? 'Clearing…' : 'Mark info received'}
          </button>
        )}
      </div>

      {open && (
        <div className="request-info-panel">
          <p className="form-hint">
            Sets claim status to <strong>needs info</strong> and stores a
            checklist for the claimant / shop.
          </p>

          {suggestedItems.length > 0 && (
            <div className="request-info-suggestions">
              <strong>AI suggestions</strong>
              <ul>
                {suggestedItems.map((item) => (
                  <li key={item}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selected.includes(item)}
                        onChange={() => toggleItem(item)}
                      />{' '}
                      {item}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="request-info-custom">
            <label htmlFor={`info-custom-${claimId}`}>Add item</label>
            <div className="request-info-custom-row">
              <input
                id={`info-custom-${claimId}`}
                type="text"
                value={customItem}
                onChange={(e) => setCustomItem(e.target.value)}
                placeholder="e.g. Last 12 months oil change receipts"
                maxLength={500}
              />
              <button
                type="button"
                className="button button-sm"
                onClick={addCustom}
                disabled={!customItem.trim()}
              >
                Add
              </button>
            </div>
          </div>

          {selected.length > 0 && (
            <div className="request-info-selected">
              <strong>Will request ({selected.length})</strong>
              <ul>
                {selected.map((item) => (
                  <li key={item}>
                    {item}{' '}
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => toggleItem(item)}
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label htmlFor={`info-note-${claimId}`}>Note (optional)</label>
          <textarea
            id={`info-note-${claimId}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Internal note or message to include with the request"
          />

          <button
            type="button"
            className="button button-sm"
            onClick={submitRequest}
            disabled={loading || selected.length === 0}
          >
            {loading ? 'Saving…' : 'Send info request'}
          </button>
        </div>
      )}

      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
