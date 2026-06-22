import { createHash } from 'node:crypto';

/**
 * Content hash used as the cache key for a comment. A short slice of sha256 is
 * plenty to avoid collisions across a single file's comments while keeping the
 * persisted cache compact.
 */
export function contentHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}
