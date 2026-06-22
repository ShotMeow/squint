/** Default actionable comment markers kept visible in the compact label. */
export const DEFAULT_MARKERS = [
  'TODO',
  'FIXME',
  'HACK',
  'XXX',
  'BUG',
  'NOTE',
  'OPTIMIZE',
  'DEPRECATED',
] as const;

const LEADING_PUNCTUATION = /^[\s/*#-]+/;

/**
 * Detect a leading actionable marker (TODO, FIXME, …) in a comment, ignoring
 * the comment punctuation. Returns the marker uppercased, or undefined. Only a
 * leading marker is recognized; markers mid-text are ignored.
 */
export function detectMarker(
  commentText: string,
  markers: readonly string[],
): string | undefined {
  const cleaned = commentText.replace(LEADING_PUNCTUATION, '');
  const upper = cleaned.toUpperCase();
  for (const marker of markers) {
    const m = marker.toUpperCase();
    if (!upper.startsWith(m)) continue;
    const after = cleaned[marker.length];
    // Require a word boundary so NOTE doesn't match NOTEBOOK.
    if (after === undefined || /[\s:(]/.test(after)) return m;
  }
  return undefined;
}

/** Remove a leading marker (and its `:`/`(...)`) from a summary, if present. */
export function stripLeadingMarker(text: string, markers: readonly string[]): string {
  const trimmed = text.trimStart();
  const upper = trimmed.toUpperCase();
  for (const marker of markers) {
    const m = marker.toUpperCase();
    if (!upper.startsWith(m)) continue;
    const after = trimmed[marker.length];
    if (after === undefined || /[\s:(]/.test(after)) {
      return trimmed.slice(marker.length).replace(/^[\s:)(-]+/, '').trimStart();
    }
  }
  return text;
}
