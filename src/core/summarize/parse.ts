import type { SummaryEntry } from './types.js';

/**
 * Extract a JSON array substring from a model response, tolerating markdown
 * code fences and surrounding prose.
 */
function extractJsonArray(raw: string): string | null {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) s = fence[1].trim();
  const start = s.indexOf('[');
  const end = s.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  return s.slice(start, end + 1);
}

/** Collapse whitespace, trim, and clamp a summary to a single capped line. */
function cleanSummary(summary: string, maxLength: number): string {
  return summary.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

/**
 * Safely parse a batch summary response into id -> {summary, body?}. Unknown
 * ids, malformed entries, and empty summaries are dropped. Any parse failure
 * yields an empty map so the caller falls back to showing the original comment.
 */
export function parseSummaryResponse(
  raw: string,
  validIds: ReadonlySet<string>,
  maxLength: number,
): Map<string, SummaryEntry> {
  const out = new Map<string, SummaryEntry>();
  if (!raw) return out;

  const json = extractJsonArray(raw);
  if (!json) return out;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return out;
  }
  if (!Array.isArray(parsed)) return out;

  for (const entry of parsed as unknown[]) {
    if (typeof entry !== 'object' || entry === null) continue;
    const rec = entry as Record<string, unknown>;
    const id = rec.id;
    const summary = rec.summary;
    if (typeof id !== 'string' || typeof summary !== 'string') continue;
    if (!validIds.has(id)) continue;
    const clean = cleanSummary(summary, maxLength);
    if (!clean) continue;
    const body = typeof rec.body === 'string' ? rec.body.trim() : '';
    out.set(id, body ? { summary: clean, body } : { summary: clean });
  }
  return out;
}
