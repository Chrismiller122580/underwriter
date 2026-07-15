'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ClaimEventRecord } from '@/lib/claim-events';

function formatWhen(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function eventLabel(type: string) {
  return type.replace(/_/g, ' ');
}

export function ClaimTimeline({
  claimId,
  refreshKey = 0,
}: {
  claimId: string;
  /** Bump to re-fetch after actions. */
  refreshKey?: number;
}) {
  const [events, setEvents] = useState<ClaimEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/claims/${claimId}/events`);
      if (response.status === 401) {
        window.location.href = '/login?next=/claims';
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to load history');
      }
      const data = (await response.json()) as { events: ClaimEventRecord[] };
      setEvents(data.events ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <section className="claim-panel claim-timeline-panel">
      <div className="claim-timeline-header">
        <h4>Decision &amp; activity history</h4>
        <button
          type="button"
          className="link-button"
          onClick={() => void load()}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {loading && <p className="claim-panel-meta">Loading history…</p>}
      {error && <p className="field-error">{error}</p>}

      {!loading && !error && events.length === 0 && (
        <p className="claim-panel-meta">
          No audit events yet. Actions (submit, AI scan, underwrite, info
          request, manual decision) appear here.
        </p>
      )}

      {!loading && events.length > 0 && (
        <ol className="claim-timeline">
          {events.map((event) => (
            <li key={event.id} className={`timeline-item timeline-${event.eventType}`}>
              <div className="timeline-meta">
                <span className="timeline-type">{eventLabel(event.eventType)}</span>
                <span className="timeline-when">{formatWhen(event.createdAt)}</span>
              </div>
              <p className="timeline-summary">{event.summary}</p>
              <p className="claim-panel-meta">
                {event.actorEmail
                  ? `${event.actorEmail}${event.actorRole ? ` · ${event.actorRole}` : ''}`
                  : 'System'}
                {event.fromStatus || event.toStatus
                  ? ` · ${event.fromStatus ?? '—'} → ${event.toStatus ?? '—'}`
                  : ''}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
