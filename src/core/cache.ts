/**
 * Minimal persistent key-value contract the cache depends on. VS Code's Memento
 * is adapted to this in the vscode layer; tests use an in-memory fake.
 */
import type { SummaryEntry } from './summarize/types.js';

export interface KeyValueStore {
  get(key: string): string | undefined;
  set(key: string, value: string): void | Thenable<void>;
  delete(key: string): void | Thenable<void>;
  keys(): readonly string[];
}

const PREFIX = 'squint.cache.v1:';

/**
 * Caches one-line summaries keyed by comment content hash. The summary language
 * and length limit are part of the key: changing either must invalidate, since
 * both change the generated output.
 */
export class SummaryCache {
  constructor(private readonly store: KeyValueStore) {}

  private key(hash: string, language: string, maxLength: number): string {
    return `${PREFIX}${language}:${maxLength}:${hash}`;
  }

  get(hash: string, language: string, maxLength: number): SummaryEntry | undefined {
    const raw = this.store.get(this.key(hash, language, maxLength));
    if (raw === undefined) return undefined;
    try {
      const parsed = JSON.parse(raw) as SummaryEntry;
      if (parsed && typeof parsed.summary === 'string') return parsed;
    } catch {
      // fall through
    }
    return undefined;
  }

  async set(
    hash: string,
    language: string,
    maxLength: number,
    entry: SummaryEntry,
  ): Promise<void> {
    await this.store.set(this.key(hash, language, maxLength), JSON.stringify(entry));
  }

  /** Remove every Squint cache entry, leaving unrelated keys untouched. */
  async clear(): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(PREFIX)) {
        await this.store.delete(key);
      }
    }
  }
}
