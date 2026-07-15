export type InfoRequestRecord = {
  items: string[];
  note?: string;
  requestedAt: string;
  requestedBy?: string;
  source: 'manual' | 'ai_suggested';
};

export function normalizeInfoRequestItems(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const item = raw.trim().replace(/\s+/g, ' ');
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.slice(0, 500));
    if (out.length >= 20) break;
  }
  return out;
}

export function buildInfoRequest(input: {
  items: string[];
  note?: string;
  requestedBy?: string;
  source?: InfoRequestRecord['source'];
}): InfoRequestRecord {
  const items = normalizeInfoRequestItems(input.items);
  if (items.length === 0) {
    throw new Error('At least one information request item is required');
  }

  return {
    items,
    note: input.note?.trim().slice(0, 2000) || undefined,
    requestedAt: new Date().toISOString(),
    requestedBy: input.requestedBy?.trim().slice(0, 200) || undefined,
    source: input.source ?? 'manual',
  };
}
