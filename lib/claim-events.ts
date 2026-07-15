import { ensureSchema, getSql } from '@/lib/db';

export type ClaimEventType =
  | 'submitted'
  | 'analyzed'
  | 'underwritten'
  | 'info_requested'
  | 'info_cleared'
  | 'manual_decision';

export type ClaimEventRecord = {
  id: string;
  claimId: string;
  eventType: ClaimEventType;
  actorEmail: string | null;
  actorRole: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  summary: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
};

type ClaimEventRow = {
  id: string;
  claim_id: string;
  event_type: string;
  actor_email: string | null;
  actor_role: string | null;
  from_status: string | null;
  to_status: string | null;
  summary: string;
  detail: Record<string, unknown> | null;
  created_at: string;
};

function mapEvent(row: ClaimEventRow): ClaimEventRecord {
  return {
    id: row.id,
    claimId: row.claim_id,
    eventType: row.event_type as ClaimEventType,
    actorEmail: row.actor_email,
    actorRole: row.actor_role,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    summary: row.summary,
    detail: row.detail,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function appendClaimEvent(input: {
  claimId: string;
  eventType: ClaimEventType;
  summary: string;
  actorEmail?: string | null;
  actorRole?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  detail?: Record<string, unknown> | null;
}): Promise<ClaimEventRecord> {
  await ensureSchema();
  const sql = getSql();

  const rows = (await sql`
    INSERT INTO claim_events (
      claim_id, event_type, actor_email, actor_role,
      from_status, to_status, summary, detail
    ) VALUES (
      ${input.claimId}::uuid,
      ${input.eventType},
      ${input.actorEmail ?? null},
      ${input.actorRole ?? null},
      ${input.fromStatus ?? null},
      ${input.toStatus ?? null},
      ${input.summary.slice(0, 1000)},
      ${input.detail ? JSON.stringify(input.detail) : null}::jsonb
    )
    RETURNING *
  `) as ClaimEventRow[];

  return mapEvent(rows[0]);
}

export async function listClaimEvents(
  claimId: string,
  limit = 50
): Promise<ClaimEventRecord[]> {
  await ensureSchema();
  const sql = getSql();
  const capped = Math.min(Math.max(limit, 1), 100);

  const rows = (await sql`
    SELECT * FROM claim_events
    WHERE claim_id = ${claimId}::uuid
    ORDER BY created_at DESC, id DESC
    LIMIT ${capped}
  `) as ClaimEventRow[];

  return rows.map(mapEvent);
}

/** Fire-and-forget style: log errors without failing the primary action. */
export async function safeAppendClaimEvent(
  input: Parameters<typeof appendClaimEvent>[0]
): Promise<void> {
  try {
    await appendClaimEvent(input);
  } catch {
    // Audit failures must not block underwriting / decisions.
  }
}
